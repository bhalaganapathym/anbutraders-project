from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from core.config import settings
from api.routes import api_router

import asyncio
import urllib.request
import logging

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

async def self_ping():
    # Render automatically sets RENDER_EXTERNAL_URL (e.g., https://my-app.onrender.com)
    url = os.environ.get("RENDER_EXTERNAL_URL")
    if not url:
        logging.info("RENDER_EXTERNAL_URL not found, self-ping disabled.")
        return
        
    while True:
        try:
            await asyncio.sleep(14 * 60) # Wait 14 minutes
            logging.info(f"Self-pinging {url}/health to prevent sleep...")
            urllib.request.urlopen(f"{url}/health")
        except Exception as e:
            logging.error(f"Self-ping failed: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(self_ping())

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)



@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def home():
    return {"message": "Anbu Traders API is running"}