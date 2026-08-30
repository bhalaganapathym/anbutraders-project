import json
import logging
import threading
from datetime import datetime, timezone
from pywebpush import webpush, WebPushException
from sqlalchemy import event
from core.config import settings
from db.session import SessionLocal
from models.all import PushSubscription, Notification

logger = logging.getLogger("anbu_push")

def send_web_push(
    title: str,
    body: str,
    url: str = "/",
    tag: str = "general",
    role: str = None
):
    """
    Sends a Web Push notification to subscribed devices in the background.
    Compatible with installed Android Chrome PWAs and iOS 16.4+ Home Screen PWAs.
    """
    db = SessionLocal()
    try:
        query = db.query(PushSubscription)
        if role and role != "all":
            # Match role hierarchy: Admin always receives dispatch/billing alerts
            if role in ["dispatch", "billing", "cashier"]:
                allowed_roles = [role, "admin", "all"]
                if role == "billing":
                    allowed_roles.append("cashier")
                elif role == "cashier":
                    allowed_roles.append("billing")
            elif role == "admin":
                allowed_roles = ["admin", "all"]
            else:
                allowed_roles = [role, "admin", "all"]

            query = query.filter(
                PushSubscription.user_role.in_(allowed_roles) | 
                PushSubscription.user_role.is_(None)
            )
        
        subscriptions = query.all()
        if not subscriptions:
            logger.info("No active push subscriptions found for role: %s", role)
            return {"sent": 0, "failed": 0, "total": 0}

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "sound": "/alert-tone.mp3",
            "timestamp": int(1000 * datetime.now(timezone.utc).timestamp())
        })

        sent_count = 0
        failed_count = 0
        dead_subscriptions = []

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                }
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL},
                    headers={"Urgency": "high", "Topic": "alert"},
                    ttl=86400  # 24 hours delivery TTL
                )
                sent_count += 1
            except WebPushException as ex:
                failed_count += 1
                logger.warning("WebPush failed for endpoint %s: %s", sub.endpoint, ex)
                # 400, 401, 403, 404, 410 means the subscription is expired, revoked, or key mismatched
                if ex.response is not None and ex.response.status_code in [400, 401, 403, 404, 410]:
                    dead_subscriptions.append(sub)
            except Exception as e:
                failed_count += 1
                logger.warning("Unexpected push exception for endpoint %s: %s", sub.endpoint, e)

        # Cleanup expired/unsubscribed endpoints
        if dead_subscriptions:
            for dead_sub in dead_subscriptions:
                try:
                    db.delete(dead_sub)
                except Exception:
                    pass
            db.commit()

        logger.info("WebPush complete: %d sent, %d failed out of %d", sent_count, failed_count, len(subscriptions))
        return {"sent": sent_count, "failed": failed_count, "total": len(subscriptions)}
    except Exception as e:
        logger.error("Error in send_web_push: %s", e)
        return {"sent": 0, "failed": 0, "error": str(e)}
    finally:
        db.close()

def dispatch_web_push_async(title: str, body: str, url: str = "/", tag: str = "general", role: str = "all"):
    """
    Non-blocking background worker that executes send_web_push asynchronously.
    """
    thread = threading.Thread(
        target=send_web_push,
        kwargs={
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
            "role": role
        },
        daemon=True
    )
    thread.start()

def get_role_and_url_for_notification(notif_type: str, dispatch_id: str = None, order_id: str = None):
    """
    Maps notification types to target roles and in-app navigation routes.
    """
    t = (notif_type or "").lower()
    
    # 1. Estimates & Orders
    if t in ["order_confirmed", "estimate_created", "advance_order_booked"]:
        return "all", "/#/orders"
    elif t in ["advance_order_due"]:
        return "all", "/#/orders"
        
    # 2. Phase 1 Dispatch -> Billing
    elif t in ["dispatch_sent_to_billing", "ready_for_billing"]:
        return "billing", "/#/billing"
        
    # 3. Weight Mismatch Requests -> Admin
    elif t in ["weight_mismatch_approval", "weight_mismatch_request"]:
        return "admin", "/#/dashboard"
        
    # 4. Weight Mismatch Decision -> Dispatch
    elif t in ["mismatch_approved", "mismatch_rejected", "weight_mismatch_decision"]:
        return "dispatch", "/#/dispatches"
        
    # 5. Discount Approval Request -> Admin
    elif t in ["discount_approval_request", "discount_request"]:
        return "admin", "/#/dashboard"
        
    # 6. Discount Decision -> Billing
    elif t in ["discount_approved", "discount_rejected", "discount_decision"]:
        return "billing", "/#/billing"
        
    # 7. Bill Generated & Settle -> Dispatch (Ready for Loading)
    elif t in ["bill_generated", "ready_for_loading"]:
        return "dispatch", "/#/dispatches"
        
    # 8. Phase 2 Dispatch Completed -> Billing / Admin
    elif t in ["dispatch_completed", "vehicle_dispatched"]:
        return "billing", "/#/billing"
        
    # 9. Driver Delivery / POD -> All
    elif t in ["delivery_completed", "pod_collected", "photo_uploaded"]:
        return "all", "/#/dispatches"
        
    # 10. Financial / Credit Overdue -> Billing & Admin
    elif t in ["today_payment_overdue", "credit_overdue", "billing_alert"]:
        return "billing", "/#/billing"
        
    return "all", "/#/notifications"

# Automatic Push Trigger: Listen to all Notification insertions in database
@event.listens_for(Notification, "after_insert")
def auto_push_on_notification_insert(mapper, connection, target):
    """
    Automatically sends a Web Push notification to subscribed devices whenever ANY notification is created.
    """
    try:
        title = target.title or "🔔 Anbu Traders Notification"
        body = target.message or "New activity update"
        role, url = get_role_and_url_for_notification(
            target.type,
            str(target.dispatch_id) if target.dispatch_id else None,
            str(target.order_id) if target.order_id else None
        )
        tag = f"notif-{target.type}-{target.id or 'item'}"
        dispatch_web_push_async(
            title=title,
            body=body,
            url=url,
            tag=tag,
            role=role
        )
    except Exception as e:
        logger.warning("Auto-push on notification insert warning: %s", e)
