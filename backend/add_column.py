import asyncio
from sqlalchemy import create_engine, text
from core.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE orders ADD COLUMN confirmed_at TIMESTAMP WITH TIME ZONE;"))
        print("Column confirmed_at added successfully")
    except Exception as e:
        print(f"Error: {e}")

