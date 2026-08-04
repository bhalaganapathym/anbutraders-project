import os
import sys
import psycopg2

DATABASE_URL = "postgresql://postgres:AnbuTraders%40143@db.icumcxpsprdlcpanqseb.supabase.co:5432/postgres"

def main():
    try:
        print("Connecting to DB...")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("Adding standard_weight column to products table...")
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS standard_weight NUMERIC DEFAULT 0;")
        
        conn.commit()
        print("Column added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
