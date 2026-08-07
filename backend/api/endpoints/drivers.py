from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from api.deps import get_db
from models.all import Driver
from schemas.all import DriverCreate, DriverResponse
from api.endpoints.ws import manager

router = APIRouter()

@router.post("", response_model=DriverResponse)
def create_driver(driver_in: DriverCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    driver = Driver(**driver_in.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "drivers"})
    return driver

@router.get("", response_model=List[DriverResponse])
def get_drivers(db: Session = Depends(get_db)):
    return db.query(Driver).all()

@router.put("/{id}", response_model=DriverResponse)
def update_driver(id: UUID, driver_in: DriverCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    driver = db.query(Driver).filter(Driver.id == id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    for key, value in driver_in.model_dump().items():
        setattr(driver, key, value)
        
    db.commit()
    db.refresh(driver)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "drivers"})
    return driver

@router.delete("/{id}")
def delete_driver(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    driver = db.query(Driver).filter(Driver.id == id).first()
    if driver:
        db.delete(driver)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "drivers"})
    return {"status": "ok"}
