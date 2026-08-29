from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging

from api.deps import get_db
from core.config import settings
from core.push import send_web_push
from models.all import PushSubscription
from schemas.all import (
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    PushTestRequest
)

router = APIRouter()
logger = logging.getLogger("anbu_push")

@router.get("/vapid-public-key")
def get_vapid_public_key():
    """
    Returns the VAPID public key needed by the browser/PWA to register push subscriptions.
    """
    return {"public_key": settings.VAPID_PUBLIC_KEY}

@router.post("/subscribe", response_model=PushSubscriptionResponse)
def subscribe_push(
    sub_in: PushSubscriptionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Registers or updates a mobile device Web Push subscription.
    """
    try:
        existing = db.query(PushSubscription).filter(
            PushSubscription.endpoint == sub_in.endpoint
        ).first()

        if existing:
            existing.p256dh = sub_in.keys.p256dh
            existing.auth = sub_in.keys.auth
            existing.user_role = sub_in.user_role or "all"
            existing.user_id = sub_in.user_id
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            target_sub = existing
        else:
            new_sub = PushSubscription(
                endpoint=sub_in.endpoint,
                p256dh=sub_in.keys.p256dh,
                auth=sub_in.keys.auth,
                user_role=sub_in.user_role or "all",
                user_id=sub_in.user_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(new_sub)
            db.commit()
            db.refresh(new_sub)
            target_sub = new_sub

        # Send an immediate confirmation push notification
        background_tasks.add_task(
            send_web_push,
            title="🔔 Anbu Traders Notifications Active",
            body="You will now receive alerts for dispatches, bills, credit dues, and approvals even when outside the app!",
            url="/#/notifications",
            tag="welcome-push",
            role=sub_in.user_role
        )

        return target_sub
    except Exception as e:
        logger.error("Failed to register push subscription: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/unsubscribe")
def unsubscribe_push(
    endpoint_data: dict,
    db: Session = Depends(get_db)
):
    """
    Removes a push subscription.
    """
    endpoint = endpoint_data.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Endpoint is required")
    
    sub = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if sub:
        db.delete(sub)
        db.commit()
        return {"status": "unsubscribed", "success": True}
    return {"status": "not_found", "success": True}

@router.post("/test")
def test_push_notification(
    req: PushTestRequest,
    background_tasks: BackgroundTasks
):
    """
    Triggers a test push notification to verify background delivery on mobile devices.
    """
    background_tasks.add_task(
        send_web_push,
        title=req.title or "🔔 Anbu Traders Test Alert",
        body=req.body or "Background notification delivered successfully!",
        url=req.url or "/",
        tag="test-push",
        role=req.role or "all"
    )
    return {"status": "test_triggered", "message": "Test push notification dispatched"}
