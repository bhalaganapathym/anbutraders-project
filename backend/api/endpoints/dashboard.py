from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, case
from datetime import datetime, date, time, timezone, timedelta
from api.deps import get_db, get_current_active_user, get_current_admin_user
from models.all import Customer, Product, Order, Dispatch, User, Bill, Weight
from typing import Dict, Any, Optional, List

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
    closed_dispatches = db.query(func.count(Dispatch.id)).filter(Dispatch.status == 'completed', Dispatch.created_at >= today_start).scalar() or 0

    # Fetch dispatches: Pending on TOP, today's completed at BOTTOM, past days' completed cleared
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
     .filter(
         or_(
             Dispatch.status != 'completed',
             Dispatch.completed_at >= today_start,
             Dispatch.created_at >= today_start
         )
     )\
     .order_by(
         case(
             (Dispatch.status == 'pending', 1),
             (Dispatch.status == 'sent_to_billing', 2),
             (Dispatch.status == 'ready_for_loading', 3),
             (Dispatch.status == 'loading', 4),
             (Dispatch.status == 'completed', 5),
             else_=6
         ),
         Dispatch.created_at.desc()
     )\
     .limit(50).all()

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

@router.get("/staff-performance")
def get_staff_performance(
    timeframe: str = Query("today", description="today, week, month, all, or custom"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    today = date.today()
    today_start = datetime.combine(today, time.min).replace(tzinfo=timezone.utc)
    
    filter_start = None
    filter_end = None
    
    if timeframe == "today":
        filter_start = today_start
    elif timeframe == "week":
        filter_start = today_start - timedelta(days=7)
    elif timeframe == "month":
        filter_start = today_start - timedelta(days=30)
    elif timeframe == "custom" and start_date:
        try:
            s_date = datetime.strptime(start_date.strip(), "%Y-%m-%d").date()
            filter_start = datetime.combine(s_date, time.min).replace(tzinfo=timezone.utc)
            if end_date:
                e_date = datetime.strptime(end_date.strip(), "%Y-%m-%d").date()
                filter_end = datetime.combine(e_date, time.max).replace(tzinfo=timezone.utc)
        except Exception:
            filter_start = today_start

    all_users = db.query(User).filter(User.is_active == True).all()
    billing_members = [u for u in all_users if (u.role or "").lower() in ["billing", "cashier"]]
    dispatch_members = [u for u in all_users if (u.role or "").lower() == "dispatch"]

    bill_query = db.query(Bill)
    if filter_start:
        bill_query = bill_query.filter(Bill.created_at >= filter_start)
    if filter_end:
        bill_query = bill_query.filter(Bill.created_at <= filter_end)
    bills = bill_query.all()

    billing_stats: Dict[str, Dict[str, Any]] = {}
    for u in billing_members:
        display_name = u.full_name or u.username.title()
        billing_stats[display_name] = {
            "staff_name": display_name,
            "username": u.username,
            "role": u.role,
            "bills_count": 0,
            "total_revenue": 0.0,
            "cash_collected": 0.0,
            "credit_pending": 0.0,
            "discount_amount": 0.0,
            "average_bill": 0.0,
            "last_active": None
        }

    for b in bills:
        raw_name = b.billed_by or "Unassigned"
        matched_key = None
        for k, v in billing_stats.items():
            if raw_name.lower() in [k.lower(), v["username"].lower()]:
                matched_key = k
                break
        if not matched_key:
            matched_key = raw_name.title() if raw_name != "Unassigned" else "Unassigned Staff"
            if matched_key not in billing_stats:
                billing_stats[matched_key] = {
                    "staff_name": matched_key,
                    "username": raw_name.lower(),
                    "role": "billing",
                    "bills_count": 0,
                    "total_revenue": 0.0,
                    "cash_collected": 0.0,
                    "credit_pending": 0.0,
                    "discount_amount": 0.0,
                    "average_bill": 0.0,
                    "last_active": None
                }
        
        entry = billing_stats[matched_key]
        entry["bills_count"] += 1
        entry["total_revenue"] = round(entry["total_revenue"] + float(b.total_amount or 0), 2)
        entry["cash_collected"] = round(entry["cash_collected"] + float(b.paid_amount or 0), 2)
        entry["credit_pending"] = round(entry["credit_pending"] + float(b.pending_amount or 0), 2)
        entry["discount_amount"] = round(entry["discount_amount"] + float(b.discount_amount or 0), 2)
        if b.created_at:
            if not entry["last_active"] or b.created_at.isoformat() > entry["last_active"]:
                entry["last_active"] = b.created_at.isoformat()

    for entry in billing_stats.values():
        if entry["bills_count"] > 0:
            entry["average_bill"] = round(entry["total_revenue"] / entry["bills_count"], 2)

    disp_query = db.query(Dispatch)
    if filter_start:
        disp_query = disp_query.filter(
            or_(
                Dispatch.created_at >= filter_start,
                Dispatch.sent_to_billing_at >= filter_start,
                Dispatch.completed_at >= filter_start
            )
        )
    if filter_end:
        disp_query = disp_query.filter(
            or_(
                Dispatch.created_at <= filter_end,
                Dispatch.completed_at <= filter_end
            )
        )
    dispatches = disp_query.all()

    dispatch_stats: Dict[str, Dict[str, Any]] = {}
    for u in dispatch_members:
        display_name = u.full_name or u.username.title()
        dispatch_stats[display_name] = {
            "staff_name": display_name,
            "username": u.username,
            "role": u.role,
            "dispatches_count": 0,
            "verified_count": 0,
            "completed_count": 0,
            "total_weight_kg": 0.0,
            "mismatch_count": 0,
            "last_active": None
        }

    for d in dispatches:
        raw_name = d.dispatched_by or d.dispatch_team or "Unassigned"
        matched_key = None
        for k, v in dispatch_stats.items():
            if raw_name.lower() in [k.lower(), v["username"].lower()]:
                matched_key = k
                break
        if not matched_key:
            matched_key = raw_name.title() if raw_name != "Unassigned" else "Unassigned Dispatch"
            if matched_key not in dispatch_stats:
                dispatch_stats[matched_key] = {
                    "staff_name": matched_key,
                    "username": raw_name.lower(),
                    "role": "dispatch",
                    "dispatches_count": 0,
                    "verified_count": 0,
                    "completed_count": 0,
                    "total_weight_kg": 0.0,
                    "mismatch_count": 0,
                    "last_active": None
                }

        entry = dispatch_stats[matched_key]
        entry["dispatches_count"] += 1
        if d.status in ["sent_to_billing", "ready_for_loading", "loading", "completed"]:
            entry["verified_count"] += 1
        if d.status == "completed":
            entry["completed_count"] += 1
        if d.mismatch_approval_status:
            entry["mismatch_count"] += 1

        for w in (d.weights or []):
            entry["total_weight_kg"] = round(entry["total_weight_kg"] + float(w.actual_weight or 0), 2)

        last_dt = d.completed_at or d.sent_to_billing_at or d.created_at
        if last_dt:
            if not entry["last_active"] or last_dt.isoformat() > entry["last_active"]:
                entry["last_active"] = last_dt.isoformat()

    billing_list = sorted(billing_stats.values(), key=lambda x: x["total_revenue"], reverse=True)
    dispatch_list = sorted(dispatch_stats.values(), key=lambda x: (x["completed_count"], x["total_weight_kg"]), reverse=True)

    total_revenue = round(sum(b["total_revenue"] for b in billing_list), 2)
    total_bills = sum(b["bills_count"] for b in billing_list)
    total_weight = round(sum(d["total_weight_kg"] for d in dispatch_list), 2)
    total_dispatches = sum(d["dispatches_count"] for d in dispatch_list)

    top_billing = billing_list[0]["staff_name"] if billing_list and billing_list[0]["bills_count"] > 0 else "None"
    top_dispatch = dispatch_list[0]["staff_name"] if dispatch_list and dispatch_list[0]["dispatches_count"] > 0 else "None"

    return {
        "timeframe": timeframe,
        "filter_start": filter_start.isoformat() if filter_start else None,
        "filter_end": filter_end.isoformat() if filter_end else None,
        "summary": {
            "total_revenue": total_revenue,
            "total_bills": total_bills,
            "total_weight_kg": total_weight,
            "total_weight_tons": round(total_weight / 1000, 2),
            "total_dispatches": total_dispatches,
            "top_billing_staff": top_billing,
            "top_dispatch_staff": top_dispatch
        },
        "billing_team": billing_list,
        "dispatch_team": dispatch_list
    }

