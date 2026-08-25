from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime

from api.deps import get_db
from models.all import Bill, Dispatch, Driver
from schemas.all import BillCreate, BillResponse
from api.endpoints.ws import manager

router = APIRouter()

@router.post("", response_model=BillResponse)
def create_bill(bill_in: BillCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Verify dispatch exists
    dispatch = db.query(Dispatch).filter(Dispatch.id == bill_in.dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
        
    driver = None
    if bill_in.driver_id:
        driver = db.query(Driver).filter(Driver.id == bill_in.driver_id).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")

    # Create bill
    bill = Bill(**bill_in.model_dump())
    db.add(bill)
    
    # Update Dispatch status
    dispatch.status = "ready_for_loading"
    dispatch.ready_for_loading_at = datetime.now()
    if driver:
        dispatch.vehicle_number = driver.vehicle_number
        dispatch.driver_name = driver.name
        dispatch.driver_mobile = driver.phone_number
        driver.status = "engaged"
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "drivers"})
        
    from models.all import Notification, Customer
    customer = db.query(Customer).filter(Customer.id == dispatch.customer_id).first()
    cust_name = customer.name if customer else (dispatch.customer.name if dispatch.customer else "Unknown")
    cust_phone = customer.phone if customer else "N/A"
    cust_addr = dispatch.delivery_address or (customer.address if customer else "Site delivery")

    notification = Notification(
        type="bill_generated",
        title=f"Bill Generated - {dispatch.dispatch_no}",
        message=f"Bill generated for {cust_name}. Phone: {cust_phone}. Address: {cust_addr}. Ready for loading.",
        dispatch_id=dispatch.id,
        order_id=dispatch.order_id,
        customer_name=cust_name
    )
    db.add(notification)

    db.commit()
    db.refresh(bill)
    
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "bills"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "customers"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    
    return bill

@router.get("", response_model=List[BillResponse])
def get_bills(db: Session = Depends(get_db)):
    return db.query(Bill).all()

@router.get("/{id}", response_model=BillResponse)
def get_bill(id: UUID, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill

@router.put("/{id}", response_model=BillResponse)
def update_bill(id: UUID, bill_in: BillCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
        
    for key, value in bill_in.model_dump().items():
        setattr(bill, key, value)
        
    db.commit()
    db.refresh(bill)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "bills"})
    return bill
