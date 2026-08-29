from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os
from core.config import settings
import core.push  # Registers SQLAlchemy push event listeners
from api.routes import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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