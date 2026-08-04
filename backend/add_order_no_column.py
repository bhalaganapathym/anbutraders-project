import os
import sys
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

def add_order_no_column():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in environment.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        # Check if order_no exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='orders' and column_name='order_no';
        """)
        if cursor.fetchone() is None:
            print("Adding order_no column to orders table...")
            cursor.execute("ALTER TABLE orders ADD COLUMN order_no VARCHAR;")
            
            # Initialize existing records with legacy ID format
            cursor.execute("UPDATE orders SET order_no = CONCAT('ORD-LEGACY-', split_part(id::text, '-', 1)) WHERE order_no IS NULL;")
            
            # Make order_no NOT NULL
            cursor.execute("ALTER TABLE orders ALTER COLUMN order_no SET NOT NULL;")
            print("order_no column added successfully.")
        else:
            print("order_no column already exists.")
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    add_order_no_column()
