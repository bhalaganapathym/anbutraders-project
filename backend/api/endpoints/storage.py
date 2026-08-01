import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from core.config import settings

try:
    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
except Exception as e:
    supabase = None
    print(f"Warning: Could not initialize Supabase client: {e}")

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    if not supabase or not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_KEY in .env"
        )
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    new_filename = f"{uuid.uuid4()}.{ext}"
    
    try:
        file_bytes = await file.read()
        content_type = file.content_type or "application/octet-stream"
        
        # Upload to Supabase Storage
        res = supabase.storage.from_(settings.SUPABASE_BUCKET_NAME).upload(
            new_filename,
            file_bytes,
            file_options={"content-type": content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(settings.SUPABASE_BUCKET_NAME).get_public_url(new_filename)
        
        return {"url": public_url}
        
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file to storage: {e}")
