import asyncio
import hashlib
import hmac
import json
import os
import random
import time
from urllib.parse import parse_qsl

import aiosqlite
import uvicorn
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import DB_NAME, init_db

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
APP_STATUS = os.getenv("APP_STATUS", "beta")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://example.com")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_telegram_data(init_data: str) -> dict:
    if not init_data:
        raise HTTPException(status_code=401, detail="Нет данных авторизации")
    parsed_data = dict(parse_qsl(init_data))
    received_hash = parsed_data.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="Нет подписи Telegram")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed_data.items())
    )
    secret_key = hmac.new(
        b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256
    ).digest()
    calculated_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if calculated_hash != received_hash:
        raise HTTPException(status_code=403, detail="Поддельная подпись!")

    user_data = json.loads(parsed_data.get("user", "{}"))
    return user_data


@app.get("/")
async def serve_index():
    return FileResponse("index.html")


@app.get("/app.js")
async def serve_js():
    return FileResponse("app.js")


@app.get("/api/me")
async def get_profile(authorization: str = Header(None)):
    user = verify_telegram_data(authorization)
    user_id = user["id"]
    username = user.get("username", f"user_{user_id}")

    if APP_STATUS == "maintenance" and user_id != ADMIN_ID:
        return {"status": "maintenance"}

    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            "INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)",
            (user_id, username),
        )
        await db.commit()
        cursor = await db.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        return {"status": "ok", "user": dict(row)}


@app.post("/api/click/sync")
async def sync_clicks(
    clicks: int = 1, authorization: str = Header(None)
):
    user = verify_telegram_data(authorization)
    user_id = user["id"]
    now = int(time.time())
    safe_clicks = max(1, min(clicks, 60))

    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            "UPDATE users SET coins = coins + ?, last_click_time = ? WHERE user_id = ?",
            (safe_clicks, now, user_id),
        )
        await db.commit()
        cursor = await db.execute(
            "SELECT coins FROM users WHERE user_id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        return {"coins": row["coins"]}


@app.post("/api/exchange")
async def exchange_coins_to_keys(
    keys_amount: int = 1, authorization: str = Header(None)
):
    user = verify_telegram_data(authorization)
    user_id = user["id"]
    cost = keys_amount * 8500

    if keys_amount < 1 or cost <= 0:
        raise HTTPException(status_code=400, detail="Некорректное количество")

    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT coins, keys FROM users WHERE user_id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        if not row or row["coins"] < cost:
            raise HTTPException(status_code=400, detail="Недостаточно монет")

        new_coins = row["coins"] - cost
        new_keys = row["keys"] + keys_amount
        await db.execute(
            "UPDATE users SET coins = ?, keys = ? WHERE user_id = ?",
            (new_coins, new_keys, user_id),
        )
        await db.commit()
        return {"coins": new_coins, "keys": new_keys}
@app.post("/api/ad/reward")
async def reward_for_ad(authorization: str = Header(None)):
    user = verify_telegram_data(authorization)
    user_id = user["id"]
    keys_won = 2 if random.random() < 0.35 else 1

    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            UPDATE users 
            SET keys = keys + ?, ads_total = ads_total + 1, ads_week = ads_week + 1, ads_month = ads_month + 1
            WHERE user_id = ?
        """,
            (keys_won, user_id),
        )
        await db.execute(
            "UPDATE system_bank SET prize_pool_usd = prize_pool_usd + 0.0015 WHERE id = 1"
        )
        await db.commit()

        cursor = await db.execute(
            "SELECT keys, ads_week, ads_month FROM users WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        return {
            "keys_won": keys_won,
            "keys": row["keys"],
            "ads_week": row["ads_week"],
            "ads_month": row["ads_month"],
        }


@app.post("/api/case/open")
async def open_standard_case(authorization: str = Header(None)):
    user = verify_telegram_data(authorization)
    user_id = user["id"]
    case_price = 50

    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT keys FROM users WHERE user_id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        if not row or row["keys"] < case_price:
            raise HTTPException(
                status_code=400, detail="Нужно 50 ключей для открытия"
            )

        bank_cursor = await db.execute(
            "SELECT prize_pool_usd FROM system_bank WHERE id = 1"
        )
        bank_row = await bank_cursor.fetchone()
        bank_usd = bank_row["prize_pool_usd"] if bank_row else 0.0

        roll = random.uniform(0, 100)
        reward_type = "keys"
        reward_value = 12
        skin_name = ""

        if roll < 50.0:
            reward_value = 12
        elif roll < 85.0:
            reward_value = 38
        elif roll < 95.0:
            reward_value = 63
        elif roll < 99.5:
            reward_value = 100
        else:
            if bank_usd >= 3.50:
                reward_type = "skin"
                skin_name = "AK-47 | Slate (Field-Tested)"
                await db.execute(
                    "UPDATE system_bank SET prize_pool_usd = prize_pool_usd - 3.00 WHERE id = 1"
                )
                await db.execute(
                    "INSERT INTO inventory (user_id, item_name, item_type, price_usd) VALUES (?, ?, 'skin', 3.0)",
                    (user_id, skin_name),
                )
            else:
                reward_value = 100

        new_keys = (
            row["keys"]
            - case_price
            + (reward_value if reward_type == "keys" else 0)
        )
        await db.execute(
            "UPDATE users SET keys = ?, cases_opened = cases_opened + 1 WHERE user_id = ?",
            (new_keys, user_id),
        )
        await db.commit()

        return {
            "reward_type": reward_type,
            "reward_value": reward_value,
            "skin_name": skin_name,
            "keys": new_keys,
        }


class PromoRequest(BaseModel):
    code: str


@app.post("/api/promo")
async def activate_promo(
    data: PromoRequest, authorization: str = Header(None)
):
    user = verify_telegram_data(authorization)
    user_id = user["id"]
    code = data.code.strip().upper()

    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT reward_keys, reward_coins, activations_left FROM promocodes WHERE code = ?",
            (code,),
        )
        promo = await cursor.fetchone()
        if not promo or promo["activations_left"] <= 0:
            raise HTTPException(
                status_code=400, detail="Промокод недействителен или закончился"
            )

        check = await db.execute(
            "SELECT 1 FROM promo_activations WHERE user_id = ? AND code = ?",
            (user_id, code),
        )
        if await check.fetchone():
            raise HTTPException(
                status_code=400, detail="Ты уже активировал этот промокод"
            )

        await db.execute(
            "INSERT INTO promo_activations (user_id, code) VALUES (?, ?)",
            (user_id, code),
        )
        await db.execute(
            "UPDATE promocodes SET activations_left = activations_left - 1 WHERE code = ?",
            (code,),
        )
        await db.execute(
            "UPDATE users SET keys = keys + ?, coins = coins + ? WHERE user_id = ?",
            (promo["reward_keys"], promo["reward_coins"], user_id),
        )
        await db.commit()

        return {
            "reward_keys": promo["reward_keys"],
            "reward_coins": promo["reward_coins"],
        }


@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    if APP_STATUS == "maintenance" and message.from_user.id != ADMIN_ID:
        await message.answer(
            "🛠 <b>Идут технические работы!</b>\n"
            "Готовим обновление и новые кейсы. Следи за новостями в нашем канале!",
            parse_mode="HTML",
        )
        return

    kb = types.InlineKeyboardMarkup(
        inline_keyboard=[
            [
                types.InlineKeyboardButton(
                    text="🎮 Открыть WestyLoot",
                    web_app=types.WebAppInfo(url=WEBAPP_URL),
                )
            ]
        ]
    )
    await message.answer(
        "🔥 <b>Добро пожаловать в WestyLoot!</b>\n\n"
        "Фарми монеты, забирай ключи за рекламу и выбивай реальные скины CS2.\n"
        "Жми кнопку ниже, чтобы начать:",
        reply_markup=kb,
        parse_mode="HTML",
    )


async def main():
    await init_db()
    port = int(os.getenv("PORT", "8000"))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)

    await asyncio.gather(
        server.serve(),
        dp.start_polling(bot),
    )


if __name__ == "__main__":
    asyncio.run(main())
