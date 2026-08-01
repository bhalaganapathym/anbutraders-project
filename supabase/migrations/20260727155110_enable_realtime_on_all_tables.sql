-- Enable real-time broadcasts for all app tables so multiple devices stay in sync.
ALTER PUBLICATION supabase_realtime ADD TABLE customers, products, orders, order_items, dispatches, dispatch_items, weights, photos, notifications;
