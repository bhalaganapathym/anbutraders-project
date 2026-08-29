from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, time, timezone
from api.deps import get_db, get_current_active_user
from models.all import Customer, Product, Order, Dispatch, User
from typing import Dict, Any

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
):
    today = date.today()
    today_start = datetime.combine(today, time.min)

    customers_count = db.query(func.count(Customer.id)).scalar() or 0
    products_count = db.query(func.count(Product.id)).scalar() or 0
    orders_count = db.query(func.count(Order.id)).scalar() or 0

    # Today's Estimates
    today_orders_count = db.query(func.count(Order.id)).filter(Order.created_at >= today_start).scalar() or 0
    pending_orders = db.query(func.count(Order.id)).filter(Order.status == 'pending').scalar() or 0
    ongoing_orders = db.query(func.count(Order.id)).filter(Order.status == 'confirmed').scalar() or 0
    closed_orders = db.query(func.count(Order.id)).filter(Order.status == 'completed').scalar() or 0

    # Today's Dispatches
    today_dispatches_count = db.query(func.count(Dispatch.id)).filter(Dispatch.created_at >= today_start).scalar() or 0
    ongoing_dispatches = db.query(func.count(Dispatch.id)).filter(Dispatch.status != 'completed').scalar() or 0
    closed_dispatches = db.query(func.count(Dispatch.id)).filter(Dispatch.status == 'completed').scalar() or 0

    # Fetch dispatches with customer and order data for timeline cards
    dispatches = db.query(
        Dispatch.id,
        Dispatch.dispatch_no,
        Dispatch.status,
        Dispatch.customer_id,
        Dispatch.order_id,
        Dispatch.created_at,
        Dispatch.sent_to_billing_at,
        Dispatch.ready_for_loading_at,
        Dispatch.loading_at,
        Dispatch.completed_at,
        Dispatch.driver_name,
        Dispatch.vehicle_number,
        Customer.name.label("customer_name"),
        Customer.phone.label("customer_phone"),
        Order.created_at.label("order_created_at"),
        Order.confirmed_at.label("order_confirmed_at"),
        Order.order_no.label("order_no")
    ).outerjoin(Customer, Dispatch.customer_id == Customer.id)\
     .outerjoin(Order, Dispatch.order_id == Order.id)\
     .order_by(Dispatch.created_at.desc())\
     .limit(20).all()

    dispatch_list = []
    for d in dispatches:
        dispatch_list.append({
            "id": str(d.id),
            "dispatch_no": d.dispatch_no,
            "status": d.status,
            "customer_id": str(d.customer_id) if d.customer_id else None,
            "order_id": str(d.order_id) if d.order_id else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "sent_to_billing_at": d.sent_to_billing_at.isoformat() if d.sent_to_billing_at else None,
            "ready_for_loading_at": d.ready_for_loading_at.isoformat() if d.ready_for_loading_at else None,
            "loading_at": d.loading_at.isoformat() if d.loading_at else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
            "driver_name": d.driver_name,
            "vehicle_number": d.vehicle_number,
            "customers": {
                "name": d.customer_name or "Unknown Customer",
                "phone": d.customer_phone or ""
            } if d.customer_name else None,
            "order": {
                "order_no": d.order_no,
                "created_at": d.order_created_at.isoformat() if d.order_created_at else None,
                "confirmed_at": d.order_confirmed_at.isoformat() if d.order_confirmed_at else None
            } if d.order_created_at else None
        })

    return {
        "customers": customers_count,
        "products": products_count,
        "orders": orders_count,
        "today_stats": {
            "dispatches": {
                "total": today_dispatches_count,
                "all_time_total": len(dispatch_list),
                "ongoing": ongoing_dispatches,
                "closed": closed_dispatches
            },
            "estimates": {
                "total": today_orders_count,
                "all_time_total": orders_count,
                "pending_to_start": pending_orders,
                "ongoing": ongoing_orders,
                "closed": closed_orders
            }
        },
        "dispatches": dispatch_list
    }
