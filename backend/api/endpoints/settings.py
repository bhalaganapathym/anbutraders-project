from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict

from api.deps import get_db
from models.all import SystemSetting
from schemas.all import SystemSettingUpdate, SystemSettingResponse
from api.endpoints.ws import manager

router = APIRouter()

@router.get("", response_model=List[SystemSettingResponse])
def get_settings(db: Session = Depends(get_db)):
    return db.query(SystemSetting).all()

@router.get("/{key}", response_model=SystemSettingResponse)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

@router.put("/{key}", response_model=SystemSettingResponse)
def update_setting(key: str, setting_in: SystemSettingUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    
    if not setting:
        setting = SystemSetting(key=key, value=setting_in.value, description=setting_in.description)
        db.add(setting)
    else:
        setting.value = setting_in.value
        if setting_in.description is not None:
            setting.description = setting_in.description
            
    db.commit()
    db.refresh(setting)
    
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "system_settings"})
    
    return setting
