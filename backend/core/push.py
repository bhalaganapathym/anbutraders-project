import json
import logging
from datetime import datetime, timezone
from pywebpush import webpush, WebPushException
from core.config import settings
from db.session import SessionLocal
from models.all import PushSubscription

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
            # Match role or subscriptions set to 'all' or NULL
            query = query.filter(
                (PushSubscription.user_role == role) | 
                (PushSubscription.user_role == "all") | 
                (PushSubscription.user_role.is_(None))
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
                    ttl=86400  # 24 hours delivery TTL
                )
                sent_count += 1
            except WebPushException as ex:
                failed_count += 1
                logger.warning("WebPush failed for endpoint %s: %s", sub.endpoint, ex)
                # 404 Not Found or 410 Gone means the user unsubscribed or revoked permission
                if ex.response is not None and ex.response.status_code in [404, 410]:
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
