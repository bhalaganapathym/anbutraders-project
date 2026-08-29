from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime, timezone

from api.deps import get_db
from models.all import Bill, Dispatch, Driver
from schemas.all import BillCreate, BillResponse
from api.endpoints.ws import manager
from core.push import send_web_push

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
    bill_data = bill_in.model_dump()
    if bill_data.get("total_amount") is not None:
        bill_data["total_amount"] = round(float(bill_data["total_amount"]), 2)
    if bill_data.get("paid_amount") is not None:
        bill_data["paid_amount"] = round(float(bill_data["paid_amount"]), 2)
    if bill_data.get("pending_amount") is not None:
        bill_data["pending_amount"] = round(float(bill_data["pending_amount"]), 2)
    
    # Carry over discount amount from dispatch if available
    disc_amt = bill_data.get("discount_amount") or dispatch.discount_amount or 0
    bill_data["discount_amount"] = round(float(disc_amt), 2)
    
    # Handle 'today payment' method: defaults due to today evening 18:00 IST (12:30 UTC)
    if bill_in.payment_method == 'today payment':
        if not bill_data.get("credit_due_date"):
            now_utc = datetime.now(timezone.utc)
            today_evening = now_utc.replace(hour=12, minute=30, second=0, microsecond=0) # 18:00 IST
            bill_data["credit_due_date"] = today_evening
        bill_data["credit_days"] = 0

    bill = Bill(**bill_data)
    db.add(bill)
    
    # Update Dispatch status
    dispatch.status = "ready_for_loading"
    dispatch.ready_for_loading_at = datetime.now(timezone.utc)
    if driver:
        dispatch.vehicle_number = driver.vehicle_number
        dispatch.driver_name = driver.name
        dispatch.driver_mobile = driver.phone_number
        driver.status = "engaged"
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "drivers"})
        
    from models.all import Notification, Customer
    customer = db.query(Customer).filter(Customer.id == dispatch.customer_id).first()
    if customer and bill_data.get("credit_due_date"):
        customer.credit_due_date = bill_data["credit_due_date"]

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
    background_tasks.add_task(
        send_web_push,
        title=notification.title,
        body=notification.message,
        url="/#/billing",
        tag=f"bill-{bill.id}",
        role="all"
    )
    
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

@router.post("/check-today-payments")
def check_today_payments(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from models.all import Notification, Customer, Dispatch
    now_utc = datetime.now(timezone.utc)
    
    # Check bills with payment_method == 'today payment' that are pending and due
    overdue_bills = db.query(Bill).filter(
        Bill.payment_method == "today payment",
        Bill.pending_amount > 0,
        Bill.is_today_payment_overdue == False,
        Bill.credit_due_date != None,
        Bill.credit_due_date <= now_utc
    ).all()

    overdue_count = 0
    for b in overdue_bills:
        b.is_today_payment_overdue = True
        cust = db.query(Customer).filter(Customer.id == b.customer_id).first()
        cust_name = cust.name if cust else "Customer"
        disp = db.query(Dispatch).filter(Dispatch.id == b.dispatch_id).first()
        disp_no = disp.dispatch_no if disp else "Bill"
        
        # High-priority alert notification to Admin and Billing
        notif = Notification(
            type="today_payment_overdue",
            title=f"⚠️ Unpaid Today Payment Alert — {disp_no}",
            message=f"Customer {cust_name} has an unpaid balance of ₹{float(b.pending_amount):,.2f} on {disp_no} due today evening. Shifted to active Customer Credit Due ledger.",
            dispatch_id=b.dispatch_id,
            order_id=b.order_id,
            customer_name=cust_name
        )
        db.add(notif)
        overdue_count += 1
        background_tasks.add_task(
            send_web_push,
            title=notif.title,
            body=notif.message,
            url="/#/billing",
            tag=f"overdue-{b.id}",
            role="all"
        )
        
    if overdue_count > 0:
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "bills"})
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "customers"})

    return {"status": "ok", "overdue_count": overdue_count}
