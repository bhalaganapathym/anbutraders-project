import os
from sqlalchemy import create_engine, text

def migrate():
    # Get DB URL
    env_path = '.env' if os.path.exists('.env') else ('backend/.env' if os.path.exists('backend/.env') else os.path.join(os.path.dirname(__file__), '.env'))
    db_url = None
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            content = f.read()
            urls = [line.split('=', 1)[1].strip() for line in content.split('\n') if line.startswith('DATABASE_URL')]
            if urls:
                db_url = urls[0]
    if not db_url:
        db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/anbu_db")
    
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
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_tolerance_minus NUMERIC;"))
            print("Added weight_tolerance and weight_tolerance_minus to products")
        except Exception as e:
            print("Skipping weight_tolerance: ", e)

        try:
            conn.execute(text("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'free';"))
            print("Added status to drivers")
        except Exception as e:
            print("Skipping driver status: ", e)

        try:
            conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS credit_due_date TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS credit_days INTEGER;"))
            conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS notes VARCHAR;"))
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_due_date TIMESTAMP WITH TIME ZONE;"))
            print("Added credit_due_date, credit_days, notes to bills & customers")
        except Exception as e:
            print("Skipping credit columns: ", e)

        try:
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_addresses JSONB DEFAULT '[]'::jsonb;"))
            print("Added delivery_addresses to customers")
        except Exception as e:
            print("Skipping delivery_addresses: ", e)

        try:
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_advance_order BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_delivery_date TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_paid_amount NUMERIC DEFAULT 0;"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_payment_method VARCHAR;"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_notes VARCHAR;"))
            conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_status VARCHAR DEFAULT 'pending';"))
            print("Added advance order fields to orders")
        except Exception as e:
            print("Skipping advance order fields: ", e)

        try:
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS phase1_draft JSONB;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_approval_status VARCHAR;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_voice_note_url VARCHAR;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_voice_note_path VARCHAR;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_reason VARCHAR;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_requested_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_approved_by VARCHAR;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_approved_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS mismatch_rejection_reason VARCHAR;"))
            print("Added phase1_draft and mismatch approval fields to dispatches")
        except Exception as e:
            print("Skipping dispatch draft & mismatch fields: ", e)

        try:
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                endpoint TEXT UNIQUE NOT NULL,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_role VARCHAR DEFAULT 'all',
                user_id VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """))
            print("Added push_subscriptions table")
        except Exception as e:
            print("Skipping push_subscriptions: ", e)

if __name__ == "__main__":
    migrate()
