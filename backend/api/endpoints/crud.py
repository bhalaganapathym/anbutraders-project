from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from api.deps import get_db, get_current_active_user
from models.all import Customer, Product, Order, OrderItem, Dispatch, DispatchItem, User, Weight, Photo, Notification
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
    from models.all import Bill
    from sqlalchemy import func
    customers = db.query(Customer).order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()
    
    pending_sums = db.query(Bill.customer_id, func.sum(Bill.pending_amount)).group_by(Bill.customer_id).all()
    pending_map = {cid: float(sum_val or 0) for cid, sum_val in pending_sums if cid}
    
    for c in customers:
        c.pending_amount = pending_map.get(c.id, 0.0)
        
    return customers

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
        p.price = max(Decimal("0"), curr_price + delta)
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
        
    db.commit()
    db.refresh(order)
    
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    return order

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
        
    if old_status != "confirmed" and order.status == "confirmed":
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
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
            
    from datetime import datetime
    from models.all import Bill, Driver
    if old_status != dispatch.status:
        if dispatch.status == "sent_to_billing":
            dispatch.sent_to_billing_at = datetime.now()
        elif dispatch.status == "completed":
            dispatch.completed_at = datetime.now()
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
    return dispatch

@router.delete("/dispatches/{id}")
def delete_dispatch(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == id).first()
    if dispatch:
        db.query(DispatchItem).filter(DispatchItem.dispatch_id == id).delete()
        db.query(Weight).filter(Weight.dispatch_id == id).delete()
        db.query(Photo).filter(Photo.dispatch_id == id).delete()
        db.delete(dispatch)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
    return {"status": "ok"}

@router.post("/dispatches/bulk-delete")
def bulk_delete_dispatches(payload: BulkDeleteRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not payload.ids:
        return {"status": "ok", "deleted": 0}
        
    db.query(DispatchItem).filter(DispatchItem.dispatch_id.in_(payload.ids)).delete(synchronize_session=False)
    db.query(Weight).filter(Weight.dispatch_id.in_(payload.ids)).delete(synchronize_session=False)
    db.query(Photo).filter(Photo.dispatch_id.in_(payload.ids)).delete(synchronize_session=False)
    deleted = db.query(Dispatch).filter(Dispatch.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
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

