from fastapi import FastAPI, APIRouter, Header, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ZWAP MineSwap API")
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Economic constants — SIMULATED.
# Everything the "real" system would compute server-side lives here so it is
# trivial to swap the simulation for real mining/pricing/liquidity later.
# ---------------------------------------------------------------------------
ZWAP_USD = 0.05                 # notional ZWAP value in USD
MINE_RATE_PER_HOUR = 120.0      # ZWAP accrued per hour while a session is active
SESSION_HOURS = 6               # a mine session runs for 6h, then must restart
SWAP_FEE_PCT = 0.01             # 1% swap fee
WITHDRAW_FEE_PCT = 0.005        # 0.5% network/withdraw fee

# Dynamic asset registry (spec: Swap Layer — supported assets & networks)
ASSET_REGISTRY = [
    {"symbol": "BTC", "name": "Bitcoin", "network": "Bitcoin", "price_usd": 64000.0, "min_withdraw": 0.0002, "decimals": 8, "color": "#f7931a"},
    {"symbol": "ETH", "name": "Ethereum", "network": "Ethereum", "price_usd": 3100.0, "min_withdraw": 0.01, "decimals": 6, "color": "#627eea"},
    {"symbol": "USDC", "name": "USD Coin", "network": "Polygon", "price_usd": 1.0, "min_withdraw": 5.0, "decimals": 2, "color": "#2775ca"},
    {"symbol": "POL", "name": "Polygon", "network": "Polygon", "price_usd": 0.55, "min_withdraw": 5.0, "decimals": 4, "color": "#8247e5"},
]
ASSET_MAP = {a["symbol"]: a for a in ASSET_REGISTRY}


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class MineStartResp(BaseModel):
    ok: bool


class SwapQuoteReq(BaseModel):
    zwap_amount: float
    to_symbol: str


class SwapExecuteReq(BaseModel):
    zwap_amount: float
    to_symbol: str


class WithdrawReq(BaseModel):
    symbol: str
    amount: float
    address: str


# ---------------------------------------------------------------------------
# User / ledger helpers
# ---------------------------------------------------------------------------
async def get_or_create_user(uid: str) -> dict:
    if not uid:
        raise HTTPException(status_code=400, detail="Missing X-User-Id header")
    user = await db.users.find_one({"id": uid})
    if user:
        return user
    doc = {
        "id": uid,
        "created_at": iso(now()),
        "zwap_balance": 0.0,
        "assets": {a["symbol"]: 0.0 for a in ASSET_REGISTRY},
        "total_mined": 0.0,
        "session": None,  # {id, started_at, expires_at, rate, last_accrued_at}
    }
    await db.users.insert_one(doc)
    return doc


def compute_pending(session: Optional[dict]):
    """Return (pending_zwap, session_active, progress_0_1, seconds_left)."""
    if not session:
        return 0.0, False, 0.0, 0
    started = datetime.fromisoformat(session["started_at"])
    expires = datetime.fromisoformat(session["expires_at"])
    last = datetime.fromisoformat(session["last_accrued_at"])
    current = now()
    tick_end = min(current, expires)
    elapsed_h = max(0.0, (tick_end - last).total_seconds() / 3600.0)
    pending = round(elapsed_h * session["rate"], 4)
    total = (expires - started).total_seconds()
    done = (min(current, expires) - started).total_seconds()
    progress = max(0.0, min(1.0, done / total)) if total > 0 else 1.0
    seconds_left = max(0, int((expires - current).total_seconds()))
    return pending, seconds_left > 0, progress, seconds_left


async def record_activity(uid: str, kind: str, title: str, detail: str, amount: str, status: str):
    await db.activities.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "kind": kind,          # mine | swap | withdraw
        "title": title,
        "detail": detail,
        "amount": amount,
        "status": status,      # confirmed | submitted | claimed
        "created_at": iso(now()),
    })


def public_user(user: dict) -> dict:
    pending, active, progress, seconds_left = compute_pending(user.get("session"))
    return {
        "id": user["id"],
        "zwap_balance": round(user["zwap_balance"], 4),
        "zwap_usd": round(user["zwap_balance"] * ZWAP_USD, 2),
        "assets": user["assets"],
        "total_mined": round(user.get("total_mined", 0.0), 4),
        "mine": {
            "active": active,
            "pending": pending,
            "progress": progress,
            "seconds_left": seconds_left,
            "rate_per_hour": MINE_RATE_PER_HOUR,
        },
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "ZWAP MineSwap API", "zwap_usd": ZWAP_USD}


@api_router.get("/me")
async def get_me(x_user_id: str = Header(None)):
    user = await get_or_create_user(x_user_id)
    return public_user(user)


@api_router.post("/mine/start", response_model=MineStartResp)
async def mine_start(x_user_id: str = Header(None)):
    user = await get_or_create_user(x_user_id)
    _, active, _, _ = compute_pending(user.get("session"))
    if active:
        raise HTTPException(status_code=400, detail="A mining session is already active")
    start = now()
    session = {
        "id": str(uuid.uuid4()),
        "started_at": iso(start),
        "expires_at": iso(start + timedelta(hours=SESSION_HOURS)),
        "rate": MINE_RATE_PER_HOUR,
        "last_accrued_at": iso(start),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"session": session}})
    return MineStartResp(ok=True)


@api_router.post("/mine/claim")
async def mine_claim(x_user_id: str = Header(None)):
    user = await get_or_create_user(x_user_id)
    session = user.get("session")
    pending, active, _, _ = compute_pending(session)
    if pending <= 0:
        raise HTTPException(status_code=400, detail="Nothing to claim yet")
    new_balance = round(user["zwap_balance"] + pending, 4)
    total_mined = round(user.get("total_mined", 0.0) + pending, 4)
    session["last_accrued_at"] = iso(now())
    if not active:
        session = None  # session finished — cleared after final claim
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"zwap_balance": new_balance, "total_mined": total_mined, "session": session}},
    )
    await record_activity(user["id"], "mine", "Mining reward claimed",
                          "Server-validated session reward", f"+{pending} ZWAP", "claimed")
    updated = await db.users.find_one({"id": user["id"]})
    return public_user(updated)


@api_router.get("/swap/assets")
async def swap_assets():
    return {"zwap_usd": ZWAP_USD, "fee_pct": SWAP_FEE_PCT, "assets": ASSET_REGISTRY}


@api_router.post("/swap/quote")
async def swap_quote(req: SwapQuoteReq, x_user_id: str = Header(None)):
    asset = ASSET_MAP.get(req.to_symbol)
    if not asset:
        raise HTTPException(status_code=400, detail="Unsupported asset")
    if req.zwap_amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount")
    gross_usd = req.zwap_amount * ZWAP_USD
    fee_usd = gross_usd * SWAP_FEE_PCT
    net_usd = gross_usd - fee_usd
    dest = net_usd / asset["price_usd"]
    return {
        "from_zwap": round(req.zwap_amount, 4),
        "to_symbol": req.to_symbol,
        "network": asset["network"],
        "rate": f"1 ZWAP ≈ {round(ZWAP_USD / asset['price_usd'], asset['decimals'])} {req.to_symbol}",
        "gross_usd": round(gross_usd, 2),
        "fee_usd": round(fee_usd, 2),
        "fee_pct": SWAP_FEE_PCT,
        "dest_amount": round(dest, asset["decimals"]),
        "expires_in": 30,
    }


@api_router.post("/swap/execute")
async def swap_execute(req: SwapExecuteReq, x_user_id: str = Header(None)):
    user = await get_or_create_user(x_user_id)
    asset = ASSET_MAP.get(req.to_symbol)
    if not asset:
        raise HTTPException(status_code=400, detail="Unsupported asset")
    if req.zwap_amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount")
    if req.zwap_amount > user["zwap_balance"] + 1e-9:
        raise HTTPException(status_code=400, detail="Insufficient ZWAP balance")
    net_usd = req.zwap_amount * ZWAP_USD * (1 - SWAP_FEE_PCT)
    dest = round(net_usd / asset["price_usd"], asset["decimals"])
    new_zwap = round(user["zwap_balance"] - req.zwap_amount, 4)
    assets = user["assets"]
    assets[req.to_symbol] = round(assets.get(req.to_symbol, 0.0) + dest, asset["decimals"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"zwap_balance": new_zwap, "assets": assets}})
    await record_activity(user["id"], "swap", f"Swapped to {req.to_symbol}",
                          f"{round(req.zwap_amount,4)} ZWAP -> {dest} {req.to_symbol}",
                          f"+{dest} {req.to_symbol}", "confirmed")
    updated = await db.users.find_one({"id": user["id"]})
    return public_user(updated)


@api_router.post("/withdraw")
async def withdraw(req: WithdrawReq, x_user_id: str = Header(None)):
    user = await get_or_create_user(x_user_id)
    asset = ASSET_MAP.get(req.symbol)
    if not asset:
        raise HTTPException(status_code=400, detail="Unsupported asset")
    if not req.address or len(req.address.strip()) < 8:
        raise HTTPException(status_code=400, detail="Enter a valid destination address")
    if req.amount < asset["min_withdraw"]:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is {asset['min_withdraw']} {req.symbol}")
    if req.amount > user["assets"].get(req.symbol, 0.0) + 1e-9:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    fee = round(req.amount * WITHDRAW_FEE_PCT, asset["decimals"])
    delivered = round(req.amount - fee, asset["decimals"])
    assets = user["assets"]
    assets[req.symbol] = round(assets[req.symbol] - req.amount, asset["decimals"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"assets": assets}})
    await record_activity(user["id"], "withdraw", f"Withdraw {req.symbol}",
                          f"To {req.address[:6]}...{req.address[-4:]} - {asset['network']}",
                          f"-{req.amount} {req.symbol}", "submitted")
    updated = await db.users.find_one({"id": user["id"]})
    return {"delivered": delivered, "fee": fee, "network": asset["network"], "user": public_user(updated)}


@api_router.get("/activity")
async def activity(x_user_id: str = Header(None)):
    await get_or_create_user(x_user_id)
    items = await db.activities.find({"user_id": x_user_id}).sort("created_at", -1).to_list(200)
    return [{k: v for k, v in i.items() if k != "_id"} for i in items]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
