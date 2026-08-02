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

if __name__ == "__main__":
    migrate()
