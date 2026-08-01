from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from api.deps import get_db, get_current_active_user
from models.all import Customer, Product, Order, Dispatch, User
from typing import Dict, Any

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_active_user) # Omitting auth for now
):
    customers_count = db.query(func.count(Customer.id)).scalar()
    products_count = db.query(func.count(Product.id)).scalar()
    orders_count = db.query(func.count(Order.id)).scalar()
    
    # Fetch all dispatches (with customer names for recent ones)
    dispatches = db.query(
        Dispatch.id,
        Dispatch.dispatch_no,
        Dispatch.status,
        Dispatch.customer_id,
        Dispatch.created_at,
        Customer.name.label("customer_name")
    ).outerjoin(Customer, Dispatch.customer_id == Customer.id).all()
    
    dispatch_list = []
    for d in dispatches:
        dispatch_list.append({
            "id": str(d.id),
            "dispatch_no": d.dispatch_no,
            "status": d.status,
            "customer_id": str(d.customer_id),
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "customers": {"name": d.customer_name} if d.customer_name else None
        })

    return {
        "customers": customers_count,
        "products": products_count,
        "orders": orders_count,
        "dispatches": dispatch_list
    }
