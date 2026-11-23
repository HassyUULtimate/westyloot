import asyncio
import hashlib
import hmac
import json
import os
import sqlite3
from contextlib import asynccontextmanager
from urllib.parse import parse_qsl

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
WEBAPP_URL = os.getenv("WEBAPP_URL", "")
DB_NAME = "/data/game.db" if os.path.exists("/data") else "game.db"

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

def init_db():
    conn = sqlite3.connect(DB_NAME)
    conn.execute("CREATE TABLE IF NOT EXISTS user_states (uid TEXT PRIMARY KEY, data TEXT)")
    conn.commit()
    conn.close()

def get_user_state(uid: str) -> dict:
    conn = sqlite3.connect(DB_NAME)
    row = conn.execute("SELECT data FROM user_states WHERE uid = ?", (uid,)).fetchone()
    conn.close()
    return json.loads(row) if row else {"coins": 0, "keys": 0, "stars": 0, "adsWeek": 0, "adsMonth": 0}

def save_user_state(uid: str, st: dict):
    conn = sqlite3.connect(DB_NAME)
    conn.execute("INSERT OR REPLACE INTO user_states (uid, data) VALUES (?, ?)", (uid, json.dumps(st)))
    conn.commit()
    conn.close()

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🎮 Играть", web_app=WebAppInfo(url=WEBAPP_URL))]]
    )
    await message.answer("Добро пожаловать в игру! Жми кнопку ниже 👇", reply_markup=kb)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    await bot.delete_webhook(drop_pending_updates=True)
    task = asyncio.create_task(dp.start_polling(bot))
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def verify_telegram_data(init_data: str) -> dict:
    if not init_data:
        raise HTTPException(status_code=401, detail="No initData")
    parsed = dict(parse_qsl(init_data))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="No hash")
    check_str = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    if hmac.new(secret, check_str.encode(), hashlib.sha256).hexdigest() != received_hash:
        raise HTTPException(status_code=403, detail="Bad signature")
    return json.loads(parsed.get("user", "{}"))

@app.get("/")
def root():
    return {"status": "ok"}

@app.post("/api/secure_load")
async def secure_load(request: Request):
    body = await request.json()
    user = verify_telegram_data(body.get("initData", ""))
    return get_user_state(str(user.get("id", "")))

@app.post("/api/secure_save")
async def secure_save(request: Request):
    body = await request.json()
    user = verify_telegram_data(body.get("initData", ""))
    uid = str(user.get("id", ""))
    old_st = get_user_state(uid)
    new_st = body.get("state", {})
    if new_st.get("keys", 0) > old_st.get("keys", 0) + 505:
        raise HTTPException(status_code=403, detail="Cheat detected: keys")
    if new_st.get("stars", 0) > old_st.get("stars", 0) + 1005:
        raise HTTPException(status_code=403, detail="Cheat detected: stars")
    save_user_state(uid, new_st)
    return {"ok": True}

@app.get("/api/leaderboard")
def get_leaderboard():
    conn = sqlite3.connect(DB_NAME)
    rows = conn.execute("SELECT uid, data FROM user_states").fetchall()
    conn.close()
    players = []
    for uid, raw in rows:
        try:
            st = json.loads(raw)
            ads = int(st.get("adsMonth", 0))
            if ads > 0:
                name = st.get("userName") or f"Игрок #{uid[-4:]}"
                players.append({"uid": uid, "name": name, "ads": ads})
        except Exception:
            pass
    players.sort(key=lambda x: x["ads"], reverse=True)
    return {"top": players[:10]}
