from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from api.deps import get_db, get_current_active_user
from models.all import Customer, Product, Order, OrderItem, Dispatch, DispatchItem, User, Weight, Photo, Notification
from schemas.all import CustomerCreate, CustomerResponse, ProductCreate, ProductResponse, OrderCreate, OrderResponse, DispatchCreate, DispatchResponse, NotificationCreate, NotificationResponse
from core.websocket import manager

router = APIRouter()

# --- CUSTOMERS ---
@router.post("/customers", response_model=CustomerResponse)
def create_customer(
    customer_in: CustomerCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    customer = Customer(**customer_in.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "customers"})
    return customer

@router.get("/customers", response_model=List[CustomerResponse])
def get_customers(db: Session = Depends(get_db), skip: int = 0, limit: int = 1000):
    return db.query(Customer).order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()

@router.put("/customers/{id}", response_model=CustomerResponse)
def update_customer(id: UUID, customer_in: CustomerCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for key, value in customer_in.model_dump().items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
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
@router.post("/orders", response_model=OrderResponse)
def create_order(
    order_in: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    order_data = order_in.model_dump(exclude={"items"})
    order = Order(**order_data)
    db.add(order)
    db.flush()
    
    for item in order_in.items:
        db.add(OrderItem(order_id=order.id, **item.model_dump()))
        # Reduce product stock
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            from decimal import Decimal
            product.stock_qty = product.stock_qty - Decimal(str(item.quantity))
            if product.stock_qty < 0:
                notification = Notification(
                    type="stock_alert",
                    title="Negative Stock Alert",
                    message=f"Stock for product '{product.name}' has gone negative ({product.stock_qty}). Please update.",
                    order_id=order.id
                )
                db.add(notification)
                background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
        
    db.commit()
    db.refresh(order)
    
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "products"})
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
    order_data = order_in.model_dump(exclude={"items"})
    for key, value in order_data.items():
        setattr(order, key, value)
        
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
        db.delete(order)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "orders"})
    return {"status": "ok"}

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
        joinedload(Dispatch.photos)
    ).order_by(Dispatch.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/dispatches/{id}", response_model=DispatchResponse)
def get_dispatch(id: UUID, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.items),
        joinedload(Dispatch.weights),
        joinedload(Dispatch.photos)
    ).filter(Dispatch.id == id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return dispatch

@router.put("/dispatches/{id}", response_model=DispatchResponse)
def update_dispatch(id: UUID, dispatch_in: DispatchCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
        
    d_data = dispatch_in.model_dump(exclude={"items", "weights", "photos"})
    for key, value in d_data.items():
        if value is not None: # Don't overwrite with none blindly if it wasn't provided, though pydantic will supply defaults
            setattr(dispatch, key, value)
        
    db.query(DispatchItem).filter(DispatchItem.dispatch_id == id).delete()
    for item in dispatch_in.items:
        db.add(DispatchItem(dispatch_id=dispatch.id, **item.model_dump()))

    db.query(Weight).filter(Weight.dispatch_id == id).delete()
    for w in dispatch_in.weights:
        db.add(Weight(dispatch_id=dispatch.id, **w.model_dump()))

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
        db.delete(dispatch)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "dispatches"})
    return {"status": "ok"}

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

@router.delete("/notifications/{id}")
def delete_notification(id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == id).first()
    if notification:
        db.delete(notification)
        db.commit()
        background_tasks.add_task(manager.broadcast, {"event": "postgres_changes", "table": "notifications"})
    return {"status": "ok"}

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
