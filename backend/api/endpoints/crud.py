from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from api.deps import get_db, get_current_active_user
from models.all import Customer, Product, Order, OrderItem, Dispatch, DispatchItem, User, Weight, Photo, Notification, Bill, Driver
from schemas.all import CustomerCreate, CustomerResponse, ProductCreate, ProductResponse, BrandPriceAdjustRequest, OrderCreate, OrderResponse, DispatchCreate, DispatchResponse, NotificationCreate, NotificationResponse, BulkDeleteRequest
from core.websocket import manager

router = APIRouter()

# --- CUSTOMERS ---
@router.post("/customers", response_model=CustomerResponse)
def create_customer(
    customer_in: CustomerCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    if customer_in.phone and customer_in.phone.strip():
        phone = customer_in.phone.strip()
        existing = db.query(Customer).filter(Customer.phone == phone).first()
        if existing:
            raise HTTPException(status_code=400, detail="A customer with this phone number already exists")
    customer = Customer(**customer_in.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    customer.pending_amount = 0.0
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "customers"})
    return customer

@router.get("/customers", response_model=List[CustomerResponse])
def get_customers(db: Session = Depends(get_db), skip: int = 0, limit: int = 1000):
    from models.all import Bill, Notification
    from sqlalchemy import func
    from datetime import date as date_cls, datetime
    
    customers = db.query(Customer).order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()
    
    # Query unpaid bills grouped by customer
    unpaid_bills = db.query(
        Bill.customer_id,
        func.sum(Bill.pending_amount).label("pending_sum"),
        func.min(Bill.credit_due_date).label("earliest_due_date"),
        func.max(Bill.credit_days).label("max_credit_days")
    ).filter(Bill.pending_amount > 0).group_by(Bill.customer_id).all()
    
    unpaid_map = {
        row.customer_id: {
            "pending": float(row.pending_sum or 0),
            "due_date": row.earliest_due_date,
            "credit_days": row.max_credit_days
        } for row in unpaid_bills if row.customer_id
    }
    
    today = date_cls.today()
    new_overdue_notifs = []
    
    for c in customers:
        info = unpaid_map.get(c.id)
        if info:
            c.pending_amount = info["pending"]
            due_date = info["due_date"] or c.credit_due_date
            c.credit_due_date = due_date
            c.credit_days = info["credit_days"]
            
            if c.pending_amount > 0 and due_date:
                due_d = due_date.date() if isinstance(due_date, datetime) else due_date
                diff = (due_d - today).days
                c.credit_days_remaining = diff
                if diff < 0:
                    c.credit_status = "overdue"
                    # Check if notification exists
                    existing_notif = db.query(Notification).filter(
                        Notification.type == "credit_overdue",
                        Notification.customer_name == c.name,
                        Notification.read == False
                    ).first()
                    if not existing_notif:
                        notif = Notification(
                            type="credit_overdue",
                            title=f"⚠️ Credit Overdue: {c.name} (₹{c.pending_amount:,.2f})",
                            message=f"Customer {c.name} ({c.phone or 'No phone'}) exceeded the agreed credit due date ({due_d.strftime('%d %b %Y')}) by {abs(diff)} day(s). Outstanding dues: ₹{c.pending_amount:,.2f}",
                            customer_name=c.name
                        )
                        new_overdue_notifs.append(notif)
                elif diff == 0:
                    c.credit_status = "due_today"
                else:
                    c.credit_status = "active"
            elif c.pending_amount > 0:
                c.credit_status = "dues_no_date"
                c.credit_days_remaining = None
            else:
                c.credit_status = "clear"
                c.credit_days_remaining = None
        else:
            c.pending_amount = 0.0
            c.credit_due_date = None
            c.credit_days = None
            c.credit_days_remaining = None
            c.credit_status = "clear"
            
    if new_overdue_notifs:
        db.add_all(new_overdue_notifs)
        try:
            db.commit()
        except Exception:
            db.rollback()
        
    return customers

@router.get("/customers/ledger/summary")
def get_customer_ledger_summary(db: Session = Depends(get_db)):
    from models.all import Bill, Customer
    from sqlalchemy import func
    
    stmt = db.query(
        Customer.id,
        Customer.name,
        Customer.phone,
        Customer.address,
        Customer.credit_due_date,
        func.count(Bill.id).label("bill_count"),
        func.coalesce(func.sum(Bill.total_amount), 0).label("total_billed"),
        func.coalesce(func.sum(Bill.paid_amount), 0).label("total_paid"),
        func.coalesce(func.sum(Bill.pending_amount), 0).label("total_balance"),
        func.max(Bill.created_at).label("last_bill_date")
    ).outerjoin(Bill, Bill.customer_id == Customer.id).group_by(Customer.id).order_by(func.coalesce(func.sum(Bill.pending_amount), 0).desc()).all()
    
    results = []
    for row in stmt:
        results.append({
            "id": str(row.id),
            "name": row.name,
            "phone": row.phone,
            "address": row.address,
            "credit_due_date": row.credit_due_date.isoformat() if row.credit_due_date else None,
            "bill_count": row.bill_count,
            "total_billed": float(row.total_billed),
            "total_paid": float(row.total_paid),
            "total_balance": float(row.total_balance),
            "last_bill_date": row.last_bill_date.isoformat() if row.last_bill_date else None
        })
    return results

@router.get("/customers/{id}/ledger")
def get_customer_ledger(id: UUID, db: Session = Depends(get_db)):
    from models.all import Bill, Customer
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    bills = db.query(Bill).options(joinedload(Bill.dispatch)).filter(Bill.customer_id == id).order_by(Bill.created_at.asc()).all()
    
    running_balance = 0.0
    transactions = []
    for b in bills:
        total = float(b.total_amount or 0)
        paid = float(b.paid_amount or 0)
        pending = float(b.pending_amount or (total - paid))
        running_balance += pending
        
        transactions.append({
            "bill_id": str(b.id),
            "dispatch_no": b.dispatch.dispatch_no if b.dispatch else "—",
            "dispatch_id": str(b.dispatch_id) if b.dispatch_id else None,
            "date": b.created_at.isoformat() if b.created_at else None,
            "payment_method": b.payment_method,
            "total_amount": total,
            "paid_amount": paid,
            "pending_amount": pending,
            "credit_due_date": b.credit_due_date.isoformat() if b.credit_due_date else None,
            "credit_days": b.credit_days,
            "running_balance": running_balance
        })
        
    return {
        "customer": {
            "id": str(customer.id),
            "name": customer.name,
            "phone": customer.phone,
            "address": customer.address,
            "credit_due_date": customer.credit_due_date.isoformat() if customer.credit_due_date else None
        },
        "total_billed": sum(t["total_amount"] for t in transactions),
        "total_paid": sum(t["paid_amount"] for t in transactions),
        "total_balance": running_balance,
        "transactions": transactions
    }

@router.put("/customers/{id}", response_model=CustomerResponse)
def update_customer(id: UUID, customer_in: CustomerCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer_in.phone and customer_in.phone.strip():
        phone = customer_in.phone.strip()
        existing = db.query(Customer).filter(Customer.phone == phone, Customer.id != id).first()
        if existing:
            raise HTTPException(status_code=400, detail="A customer with this phone number already exists")
    for key, value in customer_in.model_dump().items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    from models.all import Bill
    from sqlalchemy import func
    pending_sum = db.query(func.sum(Bill.pending_amount)).filter(Bill.customer_id == id).scalar()
    customer.pending_amount = float(pending_sum or 0)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "customers"})
    return customer

@router.delete("/customers/{id}")
def delete_customer(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if customer:
        db.delete(customer)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "customers"})
    return {"status": "ok"}

# --- PRODUCTS ---
@router.post("/products", response_model=ProductResponse)
def create_product(
    product_in: ProductCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    product = Product(**product_in.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "products"})
    return product

@router.post("/products/bulk", response_model=List[ProductResponse])
def bulk_create_products(
    products_in: List[ProductCreate],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    products = [Product(**p.model_dump()) for p in products_in]
    db.add_all(products)
    db.commit()
    for product in products:
        db.refresh(product)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "products"})
    return products

@router.post("/products/adjust-brand-prices")
def adjust_brand_prices(
    req: BrandPriceAdjustRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    brand_products = db.query(Product).filter(func.lower(Product.brand) == req.brand.lower()).all()
    if not brand_products:
        raise HTTPException(status_code=404, detail=f"No products found for brand '{req.brand}'")
    
    from decimal import Decimal
    delta = Decimal(str(req.price_delta))
    updated_count = 0
    for p in brand_products:
        curr_price = p.price or Decimal("0")
        cat = (p.category or "").lower()
        if ("steel" in cat or "tmt" in cat) and p.standard_weight and p.standard_weight > 0:
            std_weight = Decimal(str(p.standard_weight))
            price_change = delta * std_weight
        else:
            price_change = delta
            
        p.price = max(Decimal("0"), curr_price + price_change)
        updated_count += 1
        
    db.commit()
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "products"})
    return {"message": f"Successfully updated {updated_count} products for brand {req.brand}", "updated_count": updated_count}

@router.get("/products", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db), skip: int = 0, limit: int = 1000):
    return db.query(Product).order_by(Product.created_at.desc()).offset(skip).limit(limit).all()

@router.put("/products/{id}", response_model=ProductResponse)
def update_product(id: UUID, product_in: ProductCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in product_in.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "products"})
    return product

@router.delete("/products/{id}")
def delete_product(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if product:
        db.delete(product)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "products"})
    return {"status": "ok"}

# --- ORDERS ---
@router.get("/orders/next-id")
def get_next_order_id(db: Session = Depends(get_db)):
    from datetime import datetime
    today = datetime.now()
    today_str = today.strftime("%d%m%Y")
    start_of_day = today.replace(hour=0, minute=0, second=0, microsecond=0)
    count_today = db.query(Order).filter(Order.created_at >= start_of_day).count()
    return {"next_id": f"ORD{count_today + 1}-{today_str}"}

@router.post("/orders", response_model=OrderResponse)
def create_order(
    order_in: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    from datetime import datetime
    today = datetime.now()
    today_str = today.strftime("%d%m%Y")
    start_of_day = today.replace(hour=0, minute=0, second=0, microsecond=0)
    
    count_today = db.query(Order).filter(Order.created_at >= start_of_day).count()
    new_order_no = f"ORD{count_today + 1}-{today_str}"
    
    order_data = order_in.model_dump(exclude={"items", "order_no"})
    order = Order(**order_data, order_no=new_order_no)
    if order.status == "confirmed":
        order.confirmed_at = datetime.now()
    db.add(order)
    db.flush()
    
    for item in order_in.items:
        db.add(OrderItem(order_id=order.id, **item.model_dump()))
        
    # Auto-save delivery address to customer profile & recommended list
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    cust_name = customer.name if customer else "Unknown Customer"
    
    if customer and order.delivery_address and order.delivery_address.strip():
        clean_addr = order.delivery_address.strip()
        curr_addrs = list(customer.delivery_addresses or [])
        if customer.address and customer.address.strip() and customer.address.strip() not in curr_addrs:
            curr_addrs.insert(0, customer.address.strip())
        if clean_addr not in curr_addrs:
            curr_addrs.append(clean_addr)
            customer.delivery_addresses = curr_addrs
            if not customer.address or not customer.address.strip():
                customer.address = clean_addr

    # If this is an advance order, create a booking notification
    if order.is_advance_order:
        sched_date_str = order.scheduled_delivery_date.strftime("%d %b %Y") if order.scheduled_delivery_date else "Scheduled Date"
        adv_amt = float(order.advance_paid_amount or 0)
        notif = Notification(
            type="advance_order_booked",
            title=f"📦 Advance Order Booked - {new_order_no}",
            message=f"Advance order booked for {cust_name}. Scheduled Delivery: {sched_date_str}. Advance Paid: ₹{adv_amt:,.2f}.",
            order_id=order.id,
            customer_name=cust_name
        )
        db.add(notif)
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
        
    db.commit()
    db.refresh(order)
    
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "customers"})
    return order

@router.get("/orders/advance-metrics")
def get_advance_order_metrics(db: Session = Depends(get_db)):
    from datetime import date as date_cls, timedelta, datetime
    from sqlalchemy import cast, Date, func
    
    today = date_cls.today()
    tomorrow = today + timedelta(days=1)
    
    adv_orders = db.query(Order).filter(
        Order.is_advance_order == True,
        Order.status != "completed"
    ).all()
    
    today_pending = 0
    tomorrow_orders = 0
    total_pending = len(adv_orders)
    total_advance_amount = 0.0
    
    for o in adv_orders:
        total_advance_amount += float(o.advance_paid_amount or 0)
        if o.scheduled_delivery_date:
            sched_d = o.scheduled_delivery_date.date() if isinstance(o.scheduled_delivery_date, datetime) else o.scheduled_delivery_date
            if sched_d <= today:
                today_pending += 1
            elif sched_d == tomorrow:
                tomorrow_orders += 1
                
    return {
        "today_pending": today_pending,
        "tomorrow_orders": tomorrow_orders,
        "total_pending": total_pending,
        "total_advance_amount": total_advance_amount
    }

@router.get("/orders", response_model=List[OrderResponse])
def get_orders(db: Session = Depends(get_db), skip: int = 0, limit: int = 1000):
    return db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.items).joinedload(OrderItem.product)
    ).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/orders/export")
def export_orders(db: Session = Depends(get_db), skip: int = 0, limit: int = 10000):
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    orders = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.items).joinedload(OrderItem.product)
    ).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Order ID', 'Customer Name', 'Items Ordered', 'Total Amount', 'Status', 'Delivery Address', 'Date and Time'])

    for order in orders:
        customer_name = order.customer.name if order.customer else "Unknown"
        # Format date nicely; prepend a space so Excel treats it as text and doesn't show ######
        date_time = ""
        if order.created_at:
            from zoneinfo import ZoneInfo
            dt = order.created_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=ZoneInfo("UTC"))
            local_dt = dt.astimezone(ZoneInfo("Asia/Kolkata"))
            date_time = f" {local_dt.strftime('%d-%b-%Y %I:%M %p')}"
        
        items_list = []
        total_amount = 0
        for item in order.items:
            if item.product:
                items_list.append(f"{item.product.name} (x{item.quantity})")
                total_amount += float(item.quantity) * float(item.product.price or 0)
            
        items_str = "; ".join(items_list)
        
        writer.writerow([
            str(order.id), 
            customer_name, 
            items_str, 
            f"{total_amount:.2f}", 
            order.status.capitalize(),
            order.delivery_address or "N/A",
            date_time
        ])

    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders_export.csv"}
    )

@router.put("/orders/{id}")
def update_order(id: UUID, order_in: OrderCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.status
    order_data = order_in.model_dump(exclude={"items"}, exclude_unset=True)
    for key, value in order_data.items():
        if value is not None or key == "delivery_address" or key == "notes":
            setattr(order, key, value)
            
    from datetime import datetime
    if old_status != "confirmed" and order.status == "confirmed":
        order.confirmed_at = datetime.now()
    elif order.status != "confirmed":
        order.confirmed_at = None
        
    db.query(OrderItem).filter(OrderItem.order_id == id).delete()
    for item in order_in.items:
        db.add(OrderItem(order_id=order.id, **item.model_dump()))
        
    # Auto-save delivery address to customer profile & recommended list
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if customer and order.delivery_address and order.delivery_address.strip():
        clean_addr = order.delivery_address.strip()
        curr_addrs = list(customer.delivery_addresses or [])
        if customer.address and customer.address.strip() and customer.address.strip() not in curr_addrs:
            curr_addrs.insert(0, customer.address.strip())
        if clean_addr not in curr_addrs:
            curr_addrs.append(clean_addr)
            customer.delivery_addresses = curr_addrs

    if old_status != "confirmed" and order.status == "confirmed":
        customer_name = customer.name if customer else "Unknown"
        notification = Notification(
            type="order_confirmed",
            title="New Order Confirmed",
            message=f"Order {str(order.id)[:8]} for {customer_name} has been confirmed and is ready for dispatch.",
            order_id=order.id,
            customer_name=customer_name
        )
        db.add(notification)
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
        
    db.commit()
    db.refresh(order)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    return order

@router.delete("/orders/{id}")
def delete_order(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == id).first()
    if order:
        db.query(OrderItem).filter(OrderItem.order_id == id).delete()
        db.delete(order)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    return {"status": "ok"}

@router.post("/orders/bulk-delete")
def bulk_delete_orders(payload: BulkDeleteRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not payload.ids:
        return {"status": "ok", "deleted": 0}
    
    # Delete child order items first
    db.query(OrderItem).filter(OrderItem.order_id.in_(payload.ids)).delete(synchronize_session=False)
    # Delete orders
    deleted = db.query(Order).filter(Order.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    return {"status": "ok", "deleted": deleted}

# --- DISPATCHES ---
@router.post("/dispatches", response_model=DispatchResponse)
def create_dispatch(
    dispatch_in: DispatchCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    d_data = dispatch_in.model_dump(exclude={"items"})
    dispatch = Dispatch(**d_data)
    db.add(dispatch)
    db.flush()
    
    for item in dispatch_in.items:
        db.add(DispatchItem(dispatch_id=dispatch.id, **item.model_dump()))
        
    db.commit()
    db.refresh(dispatch)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
    return dispatch

@router.get("/dispatches", response_model=List[DispatchResponse])
def get_dispatches(db: Session = Depends(get_db), skip: int = 0, limit: int = 1000):
    return db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.items),
        joinedload(Dispatch.weights),
        joinedload(Dispatch.photos),
        joinedload(Dispatch.order),
        joinedload(Dispatch.bill)
    ).order_by(Dispatch.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/dispatches/{id}", response_model=DispatchResponse)
def get_dispatch(id: UUID, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.items),
        joinedload(Dispatch.weights),
        joinedload(Dispatch.photos),
        joinedload(Dispatch.order),
        joinedload(Dispatch.bill)
    ).filter(Dispatch.id == id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return dispatch

@router.put("/dispatches/{id}", response_model=DispatchResponse)
def update_dispatch(id: UUID, dispatch_in: DispatchCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
        
    old_status = dispatch.status
    d_data = dispatch_in.model_dump(exclude={"items", "weights", "photos"})
    for key, value in d_data.items():
        if value is not None: # Don't overwrite with none blindly if it wasn't provided, though pydantic will supply defaults
            setattr(dispatch, key, value)
            
    if old_status != dispatch.status:
        if dispatch.status == "sent_to_billing":
            dispatch.sent_to_billing_at = datetime.now()
        elif dispatch_in.status == "completed":
            dispatch.completed_at = datetime.now()
            if dispatch.order_id:
                order = db.query(Order).filter(Order.id == dispatch.order_id).first()
                if order:
                    order.status = "completed"
            bill = db.query(Bill).filter(Bill.dispatch_id == id).first()
            if bill and bill.driver_id:
                driver = db.query(Driver).filter(Driver.id == bill.driver_id).first()
                if driver:
                    driver.status = "free"
            elif dispatch.driver_mobile:
                driver = db.query(Driver).filter(Driver.phone_number == dispatch.driver_mobile).first()
                if driver:
                    driver.status = "free"

    if dispatch_in.items:
        db.query(DispatchItem).filter(DispatchItem.dispatch_id == id).delete()
        for item in dispatch_in.items:
            db.add(DispatchItem(dispatch_id=dispatch.id, **item.model_dump()))

    if dispatch_in.weights is not None:
        db.query(Weight).filter(Weight.dispatch_id == id).delete()
        for w in dispatch_in.weights:
            db.add(Weight(dispatch_id=dispatch.id, **w.model_dump()))

    if dispatch_in.photos is not None:
        db.query(Photo).filter(Photo.dispatch_id == id).delete()
        for p in dispatch_in.photos:
            db.add(Photo(dispatch_id=dispatch.id, **p.model_dump()))
        
    db.commit()
    db.refresh(dispatch)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    return dispatch

@router.delete("/dispatches/{id}")
def delete_dispatch(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == id).first()
    if dispatch:
        order_id = dispatch.order_id
        db.query(DispatchItem).filter(DispatchItem.dispatch_id == id).delete()
        db.query(Weight).filter(Weight.dispatch_id == id).delete()
        db.query(Photo).filter(Photo.dispatch_id == id).delete()
        db.query(Bill).filter(Bill.dispatch_id == id).delete()
        db.delete(dispatch)
        
        # Clean up associated order so it never resurrects under New Deliveries
        if order_id:
            db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
            db.query(Order).filter(Order.id == order_id).delete()
            
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "bills"})
    return {"status": "ok"}

@router.post("/dispatches/bulk-delete")
def bulk_delete_dispatches(payload: BulkDeleteRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not payload.ids:
        return {"status": "ok", "deleted": 0}
        
    dispatches = db.query(Dispatch).filter(Dispatch.id.in_(payload.ids)).all()
    order_ids = [d.order_id for d in dispatches if d.order_id]
    
    db.query(DispatchItem).filter(DispatchItem.dispatch_id.in_(payload.ids)).delete(synchronize_session=False)
    db.query(Weight).filter(Weight.dispatch_id.in_(payload.ids)).delete(synchronize_session=False)
    db.query(Photo).filter(Photo.dispatch_id.in_(payload.ids)).delete(synchronize_session=False)
    db.query(Bill).filter(Bill.dispatch_id.in_(payload.ids)).delete(synchronize_session=False)
    deleted = db.query(Dispatch).filter(Dispatch.id.in_(payload.ids)).delete(synchronize_session=False)
    
    if order_ids:
        db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
        db.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
        
    db.commit()
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "bills"})
    return {"status": "ok", "deleted": deleted}

# --- NOTIFICATIONS ---
@router.post("/notifications", response_model=NotificationResponse)
def create_notification(
    notification_in: NotificationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    notification = Notification(**notification_in.model_dump())
    db.add(notification)
    db.commit()
    db.refresh(notification)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    return notification

@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(db: Session = Depends(get_db), skip: int = 0, limit: int = 1000):
    from models.all import Bill, Customer
    from sqlalchemy import func
    from datetime import date as date_cls, datetime

    # Check for overdue bills and create notifications if needed
    today = date_cls.today()
    unpaid_overdue = db.query(
        Bill.customer_id,
        func.sum(Bill.pending_amount).label("pending_sum"),
        func.min(Bill.credit_due_date).label("earliest_due_date")
    ).filter(Bill.pending_amount > 0, Bill.credit_due_date.isnot(None))\
     .group_by(Bill.customer_id).all()

    new_notifs = False
    for row in unpaid_overdue:
        if row.earliest_due_date:
            due_d = row.earliest_due_date.date() if isinstance(row.earliest_due_date, datetime) else row.earliest_due_date
            diff = (due_d - today).days
            if diff < 0:
                cust = db.query(Customer).filter(Customer.id == row.customer_id).first()
                if cust:
                    existing = db.query(Notification).filter(
                        Notification.type == "credit_overdue",
                        Notification.customer_name == cust.name,
                        Notification.read == False
                    ).first()
                    if not existing:
                        notif = Notification(
                            type="credit_overdue",
                            title=f"⚠️ Credit Overdue: {cust.name} (₹{float(row.pending_sum or 0):,.2f})",
                            message=f"Customer {cust.name} ({cust.phone or 'No phone'}) exceeded the agreed credit due date ({due_d.strftime('%d %b %Y')}) by {abs(diff)} day(s). Outstanding dues: ₹{float(row.pending_sum or 0):,.2f}",
                            customer_name=cust.name
                        )
                        db.add(notif)
                        new_notifs = True
    if new_notifs:
        try:
            db.commit()
        except Exception:
            db.rollback()

    return db.query(Notification).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

@router.put("/notifications/{id}", response_model=NotificationResponse)
def update_notification(id: UUID, notification_in: NotificationCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    for key, value in notification_in.model_dump().items():
        setattr(notification, key, value)
    db.commit()
    db.refresh(notification)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    return notification

@router.post("/notifications/bulk-delete")
def bulk_delete_notifications(payload: BulkDeleteRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not payload.ids:
        return {"status": "ok", "deleted": 0}
        
    deleted = db.query(Notification).filter(Notification.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    return {"status": "ok", "deleted": deleted}

@router.delete("/notifications/clear-all")
def clear_all_notifications(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    deleted = db.query(Notification).delete(synchronize_session=False)
    db.commit()
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    return {"status": "ok", "deleted": deleted}

@router.delete("/notifications/{id}/image")
def delete_notification_image(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    image_url = notification.image_url
    if image_url:
        if notification.dispatch_id:
            photo = db.query(Photo).filter(Photo.dispatch_id == notification.dispatch_id, Photo.url == image_url).first()
            if photo:
                db.delete(photo)
        
        notification.image_url = None
        db.commit()
        db.refresh(notification)
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    
    return {"status": "ok"}

@router.delete("/notifications/{id}")
def delete_notification(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == id).first()
    if notification:
        db.delete(notification)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    return {"status": "ok"}

# --- DAILY RECONCILIATION REPORT ---
@router.get("/reports/daily-reconciliation")
def get_daily_reconciliation(date: str = None, db: Session = Depends(get_db)):
    from datetime import datetime, date as date_cls
    from models.all import Bill
    from sqlalchemy import cast, Date
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            target_date = date_cls.today()
    else:
        target_date = date_cls.today()
        
    bills = db.query(Bill).options(
        joinedload(Bill.dispatch),
        joinedload(Bill.customer),
        joinedload(Bill.driver)
    ).filter(cast(Bill.created_at, Date) == target_date).all()
    
    total_billed = sum(float(b.total_amount or 0) for b in bills)
    total_paid = sum(float(b.paid_amount or 0) for b in bills)
    total_pending = sum(float(b.pending_amount or 0) for b in bills)
    
    by_payment_method = {}
    for b in bills:
        mode = b.payment_method or "Cash"
        by_payment_method[mode] = by_payment_method.get(mode, 0.0) + float(b.paid_amount or 0)
        
    driver_map = {}
    for b in bills:
        driver_name = b.driver.name if b.driver else (b.dispatch.driver_name if b.dispatch and b.dispatch.driver_name else "Direct / Unassigned")
        driver_id = str(b.driver_id) if b.driver_id else driver_name
        
        if driver_id not in driver_map:
            driver_map[driver_id] = {
                "driver_id": driver_id,
                "driver_name": driver_name,
                "vehicle_number": b.dispatch.vehicle_number if b.dispatch else "—",
                "trips": 0,
                "cash_collected": 0.0,
                "upi_collected": 0.0,
                "bills": []
            }
        driver_map[driver_id]["trips"] += 1
        paid = float(b.paid_amount or 0)
        if "cash" in (b.payment_method or "").lower():
            driver_map[driver_id]["cash_collected"] += paid
        else:
            driver_map[driver_id]["upi_collected"] += paid
            
        driver_map[driver_id]["bills"].append({
            "bill_id": str(b.id),
            "dispatch_no": b.dispatch.dispatch_no if b.dispatch else "—",
            "customer_name": b.customer.name if b.customer else "—",
            "total_amount": float(b.total_amount or 0),
            "paid_amount": paid,
            "pending_amount": float(b.pending_amount or 0),
            "payment_method": b.payment_method
        })
        
    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "total_bills_count": len(bills),
        "total_billed": total_billed,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "payment_modes": by_payment_method,
        "drivers_summary": list(driver_map.values())
    }

# --- PUBLIC ORDER TRACKING & DIGITAL RECEIPT ---
@router.get("/public/track/{tracking_ref}")
def get_public_tracking_info(tracking_ref: str, db: Session = Depends(get_db)):
    from models.all import Dispatch, Bill, Customer, Photo, Weight
    query = db.query(Dispatch).options(
        joinedload(Dispatch.items),
        joinedload(Dispatch.photos),
        joinedload(Dispatch.customer),
        joinedload(Dispatch.bill)
    )
    
    dispatch = None
    try:
        uuid_obj = UUID(tracking_ref)
        dispatch = query.filter(Dispatch.id == uuid_obj).first()
    except (ValueError, AttributeError):
        pass
        
    if not dispatch:
        dispatch = query.filter(func.lower(Dispatch.dispatch_no) == tracking_ref.lower().strip()).first()
        
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
        
    bill = dispatch.bill
    total_amount = float(bill.total_amount) if bill else sum((float(i.price or 0) * float(i.quantity or 1)) for i in dispatch.items)
    paid_amount = float(bill.paid_amount) if bill else 0.0
    pending_amount = float(bill.pending_amount) if bill else (total_amount - paid_amount)
    
    weights_list = [float(w.actual_weight) for w in dispatch.weights if w.actual_weight is not None]
    actual_wt = weights_list[0] if weights_list else None

    return {
        "dispatch_id": str(dispatch.id),
        "dispatch_no": dispatch.dispatch_no,
        "status": dispatch.status,
        "created_at": dispatch.created_at.isoformat() if dispatch.created_at else None,
        "customer": {
            "name": dispatch.customer.name if dispatch.customer else "Customer",
            "phone": dispatch.customer.phone if dispatch.customer else "",
            "address": dispatch.delivery_address or (dispatch.customer.address if dispatch.customer else "")
        },
        "transport": {
            "vehicle_number": dispatch.vehicle_number or "—",
            "driver_name": dispatch.driver_name or "Assigned Driver",
            "driver_mobile": dispatch.driver_mobile or "—"
        },
        "weights": {
            "gross_weight": actual_wt,
            "tare_weight": None,
            "net_weight": actual_wt
        },
        "items": [
            {
                "product_name": it.product_name,
                "quantity": float(it.quantity),
                "unit": it.unit,
                "price": float(it.price or 0)
            } for it in dispatch.items
        ],
        "financials": {
            "total_amount": total_amount,
            "paid_amount": paid_amount,
            "pending_amount": pending_amount,
            "payment_method": bill.payment_method if bill else "Cash"
        },
        "pod_photo": dispatch.photos[0].url if dispatch.photos else None
    }


