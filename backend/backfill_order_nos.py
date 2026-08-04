import os
import sys
import psycopg2
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

def backfill_order_nos():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in environment.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        # Fetch all orders ordered by created_at ascending
        cursor.execute("SELECT id, created_at FROM orders ORDER BY created_at ASC;")
        orders = cursor.fetchall()
        
        daily_counts = {}
        for order_id, created_at in orders:
            # created_at is a datetime object
            date_str = created_at.strftime("%d%m%Y")
            if date_str not in daily_counts:
                daily_counts[date_str] = 0
            
            daily_counts[date_str] += 1
            new_order_no = f"ORD{daily_counts[date_str]}-{date_str}"
            
            cursor.execute("UPDATE orders SET order_no = %s WHERE id = %s;", (new_order_no, order_id))
            print(f"Updated {order_id} to {new_order_no}")
            
        print("Successfully backfilled all order numbers!")
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    backfill_order_nos()
