import os
from sqlalchemy import create_engine, text

def migrate():
    # Get DB URL
    with open('.env', 'r') as f:
        content = f.read()
        db_url = [line.split('=')[1].strip() for line in content.split('\n') if line.startswith('DATABASE_URL')][0]
    
    engine = create_engine(db_url)
    with engine.begin() as conn:
        print("Running migrations...")
        try:
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url VARCHAR;"))
            print("Added image_url to notifications")
        except Exception as e:
            print("Skipping image_url: ", e)
            
        try:
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS driver_name VARCHAR;"))
            print("Added driver_name to dispatches")
        except Exception as e:
            print("Skipping driver_name: ", e)

        try:
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS driver_mobile VARCHAR;"))
            print("Added driver_mobile to dispatches")
        except Exception as e:
            print("Skipping driver_mobile: ", e)

        try:
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR PRIMARY KEY,
                value VARCHAR NOT NULL,
                description VARCHAR,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """))
            print("Added system_settings table")
        except Exception as e:
            print("Skipping system_settings: ", e)

        try:
            conn.execute(text("DELETE FROM customers a USING customers b WHERE a.id > b.id AND a.phone = b.phone AND a.phone IS NOT NULL AND a.phone != '';"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL AND phone != '';"))
            print("Deduplicated customer phones & added UNIQUE index")
        except Exception as e:
            print("Skipping customer phone index: ", e)

        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_tolerance NUMERIC;"))
            print("Added weight_tolerance to products")
        except Exception as e:
            print("Skipping weight_tolerance: ", e)

        try:
            conn.execute(text("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'free';"))
            print("Added status to drivers")
        except Exception as e:
            print("Skipping driver status: ", e)

if __name__ == "__main__":
    migrate()
