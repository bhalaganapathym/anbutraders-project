from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os
from core.config import settings
import core.push  # Registers SQLAlchemy push event listeners
from api.routes import api_router
from db.session import engine
from db.base_class import Base
from sqlalchemy import text
import models.all  # Ensure all models are registered

Base.metadata.create_all(bind=engine)

# Ensure new columns on existing tables are present
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS prior_pending_paid NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS unloading_charge NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_tolerance NUMERIC;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_tolerance_minus NUMERIC;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_conversion_qty INTEGER;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_aac_block BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS piece_weight_kg NUMERIC(12, 3);"))
        conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_unloading_charge NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_transport_charge NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_transport_charge_type VARCHAR DEFAULT 'fixed';"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS unloading_charge NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS transport_charge NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS transport_charge_type VARCHAR DEFAULT 'fixed';"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_details JSON;"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(12, 3) DEFAULT 0.00;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS notes VARCHAR;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS pod_voice_note_url VARCHAR;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS pod_voice_note_path VARCHAR;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR;"))
        conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS billed_by VARCHAR;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS dispatched_by VARCHAR;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS verifying_by VARCHAR;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS trip_number INTEGER DEFAULT 1;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS total_trips INTEGER DEFAULT 1;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS master_dispatch_id UUID;"))
        conn.execute(text("ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS bill_id UUID;"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by VARCHAR;"))
        conn.commit()
except Exception as e:
    print(f"Schema sync notice: {e}")

def seed_initial_team_members():
    from db.session import SessionLocal
    from models.all import User
    from core import security
    from sqlalchemy import func
    
    INITIAL_STAFF = [
        # Billing Team
        {"username": "sundar", "full_name": "Sundar", "email": "sundar@anbu.com", "password": "sundar@anbu123", "role": "billing"},
        {"username": "chandralekha", "full_name": "Chandralekha", "email": "chandralekha@anbu.com", "password": "chandra@anbu123", "role": "billing"},
        {"username": "sneka", "full_name": "Sneka", "email": "sneka@anbu.com", "password": "sneka@anbu123", "role": "billing"},
        {"username": "dhinesh", "full_name": "Dhinesh", "email": "dhinesh@anbu.com", "password": "dhinesh@anbu123", "role": "billing"},
        {"username": "ramana", "full_name": "Ramana", "email": "ramana@anbu.com", "password": "ramana@anbu123", "role": "billing"},
        # Dispatch Team
        {"username": "praveen", "full_name": "Praveen", "email": "praveen@anbu.com", "password": "praveen@anbu123", "role": "dispatch"},
        {"username": "prasath", "full_name": "Prasath", "email": "prasath@anbu.com", "password": "prasath@anbu123", "role": "dispatch"},
        {"username": "sathish", "full_name": "Sathish", "email": "sathish@anbu.com", "password": "sathish@anbu123", "role": "dispatch"},
        {"username": "hariharan", "full_name": "Hariharan", "email": "hariharan@anbu.com", "password": "hariharan@anbu123", "role": "dispatch"},
        # Marketing Team
        {"username": "marketing", "full_name": "Marketing Team", "email": "marketing@anbu.com", "password": "marketing123", "role": "marketing"},
    ]
    
    db = SessionLocal()
    try:
        for staff in INITIAL_STAFF:
            u = db.query(User).filter(
                (func.lower(User.username) == staff["username"].lower()) |
                (func.lower(User.email) == staff["email"].lower())
            ).first()
            if not u:
                new_u = User(
                    username=staff["username"].lower(),
                    full_name=staff["full_name"],
                    email=staff["email"].lower(),
                    hashed_password=security.get_password_hash(staff["password"]),
                    role=staff["role"].lower(),
                    is_active=True,
                    secret_question="What is your favorite color?",
                    secret_answer_hash=security.get_password_hash("blue")
                )
                db.add(new_u)
            else:
                if not u.full_name:
                    u.full_name = staff["full_name"]
                if u.role != staff["role"]:
                    u.role = staff["role"].lower()
        db.commit()
    except Exception as e:
        print(f"Team seeding notice: {e}")
        db.rollback()
    finally:
        db.close()

try:
    seed_initial_team_members()
except Exception as e:
    print(f"Startup seeding notice: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

from core.idempotency import IdempotencyMiddleware

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Idempotency Middleware to prevent duplicate operations during network retry
app.add_middleware(IdempotencyMiddleware, max_entries=500, ttl_seconds=600)

os.makedirs("uploads/voice_notes", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/track/{ref}", response_class=HTMLResponse)
def get_track_og_page(ref: str):
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Anbu Traders — Dispatch Tracking {ref}</title>
    <meta property="og:title" content="ANBU TRADERS — Dispatch {ref}" />
    <meta property="og:description" content="View live delivery status, vehicle details & verified weighbridge invoice." />
    <meta property="og:image" content="https://raw.githubusercontent.com/bhalaganapathym/anbutraders-project/main/public/pwa-512x512.png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:type" content="website" />
    <meta http-equiv="refresh" content="0; url=/#/track/{ref}" />
</head>
<body>
    <p>Redirecting to tracking {ref}...</p>
</body>
</html>"""

@app.get("/statement/{customer_id}", response_class=HTMLResponse)
def get_statement_og_page(customer_id: str):
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Anbu Traders — Customer Statement</title>
    <meta property="og:title" content="ANBU TRADERS — Statement & Receipt" />
    <meta property="og:description" content="Click to view digital invoice statement and payment ledger." />
    <meta property="og:image" content="https://raw.githubusercontent.com/bhalaganapathym/anbutraders-project/main/public/pwa-512x512.png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:type" content="website" />
    <meta http-equiv="refresh" content="0; url=/#/customers" />
</head>
<body>
    <p>Redirecting to customer statement...</p>
</body>
</html>"""

@app.get("/")
def home():
    return {"message": "Anbu Traders API is running"}