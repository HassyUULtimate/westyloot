import aiosqlite

DB_NAME = "game.db"


async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                coins INTEGER DEFAULT 0,
                keys INTEGER DEFAULT 50,
                stars_balance INTEGER DEFAULT 0,
                ads_total INTEGER DEFAULT 0,
                ads_week INTEGER DEFAULT 0,
                ads_month INTEGER DEFAULT 0,
                cases_opened INTEGER DEFAULT 0,
                bp_level INTEGER DEFAULT 1,
                bp_is_premium INTEGER DEFAULT 0,
                last_daily_spin INTEGER DEFAULT 0,
                last_click_time INTEGER DEFAULT 0,
                steam_trade_url TEXT DEFAULT '',
                is_banned INTEGER DEFAULT 0
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                item_name TEXT,
                item_type TEXT,
                price_usd REAL,
                status TEXT DEFAULT 'in_inventory'
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS promocodes (
                code TEXT PRIMARY KEY,
                reward_keys INTEGER DEFAULT 0,
                reward_coins INTEGER DEFAULT 0,
                activations_left INTEGER DEFAULT 100
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS promo_activations (
                user_id INTEGER,
                code TEXT,
                PRIMARY KEY (user_id, code)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS system_bank (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                prize_pool_usd REAL DEFAULT 0.0
            )
        """)
        await db.execute(
            "INSERT OR IGNORE INTO system_bank (id, prize_pool_usd) VALUES (1, 0.0)"
        )

        await db.execute("""
            INSERT OR IGNORE INTO promocodes (code, reward_keys, reward_coins, activations_left)
            VALUES ('KOMPENSACIYA', 10, 15000, 100)
        """)

        await db.commit()