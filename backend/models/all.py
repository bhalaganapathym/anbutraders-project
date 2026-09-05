from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, DateTime, Boolean, JSON, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base_class import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    secret_question = Column(String, nullable=True)
    secret_answer_hash = Column(String, nullable=True)
    role = Column(String, default="Cashier")  # admin, billing, dispatch
    is_active = Column(Boolean, default=True)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    phone = Column(String)
    address = Column(String)
    delivery_addresses = Column(JSON, nullable=True, default=list)
    credit_due_date = Column(DateTime(timezone=True), nullable=True)
    default_unloading_charge = Column(Numeric, default=0, nullable=True)
    default_transport_charge = Column(Numeric, default=0, nullable=True)
    default_transport_charge_type = Column(String, default="fixed", nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    address = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    unit = Column(String, default='piece', nullable=False)
    stock_qty = Column(Numeric, default=0, nullable=False)
    price = Column(Numeric, default=0, nullable=False)
    brand = Column(String)
    size = Column(String)
    standard_weight = Column(Numeric, default=0, nullable=True)
    weight_tolerance = Column(Numeric, nullable=True)
    weight_tolerance_minus = Column(Numeric, nullable=True)
    bundle_conversion_qty = Column(Integer, nullable=True)
    is_aac_block = Column(Boolean, default=False, nullable=True)
    piece_weight_kg = Column(Numeric, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class Order(Base):
    __tablename__ = "orders"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    order_no = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="pending", nullable=False)
    delivery_address = Column(String)
    notes = Column(String)
    is_advance_order = Column(Boolean, default=False, nullable=False)
    scheduled_delivery_date = Column(DateTime(timezone=True), nullable=True)
    advance_paid_amount = Column(Numeric, default=0, nullable=False)
    advance_payment_method = Column(String, nullable=True)
    advance_notes = Column(String, nullable=True)
    advance_status = Column(String, default="pending", nullable=True)
    unloading_charge = Column(Numeric, default=0, nullable=True)
    transport_charge = Column(Numeric, default=0, nullable=True)
    transport_charge_type = Column(String, default="fixed", nullable=True)
    total_weight_kg = Column(Numeric, default=0, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    
    customer = relationship("Customer")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric, default=1, nullable=False)
    unit = Column(String, nullable=True)
    
    order = relationship("Order", back_populates="items")
    product = relationship("Product")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    vehicle_number = Column(String, nullable=False)
    driver_name = Column(String, nullable=False)
    driver_mobile = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class Driver(Base):
    __tablename__ = "drivers"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    vehicle_number = Column(String)
    status = Column(String, default="free")

class Dispatch(Base):
    __tablename__ = "dispatches"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    dispatch_no = Column(String, nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    delivery_address = Column(String)
    status = Column(String, default="pending", nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"))
    vehicle_number = Column(String, nullable=True)
    driver_name = Column(String, nullable=True)
    driver_mobile = Column(String, nullable=True)
    sent_to_billing_at = Column(DateTime(timezone=True), nullable=True)
    ready_for_loading_at = Column(DateTime(timezone=True), nullable=True)
    loading_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    vehicle_leave_photo_url = Column(String, nullable=True)
    dispatch_team = Column(String)
    phase1_draft = Column(JSON, nullable=True)
    mismatch_approval_status = Column(String, nullable=True)  # 'pending', 'approved', 'rejected'
    mismatch_voice_note_url = Column(String, nullable=True)
    mismatch_voice_note_path = Column(String, nullable=True)
    mismatch_reason = Column(String, nullable=True)
    mismatch_requested_at = Column(DateTime(timezone=True), nullable=True)
    mismatch_approved_by = Column(String, nullable=True)
    mismatch_approved_at = Column(DateTime(timezone=True), nullable=True)
    mismatch_rejection_reason = Column(String, nullable=True)
    
    # Discount Fields & Admin Approval
    discount_amount = Column(Numeric, default=0, nullable=False)
    discount_reason = Column(String, nullable=True)
    discount_approval_status = Column(String, nullable=True)  # 'none', 'pending', 'approved', 'rejected'
    discount_requested_by = Column(String, nullable=True)
    discount_approved_by = Column(String, nullable=True)
    discount_requested_at = Column(DateTime(timezone=True), nullable=True)
    discount_approved_at = Column(DateTime(timezone=True), nullable=True)
    discount_rejection_reason = Column(String, nullable=True)
    discount_details = Column(JSON, nullable=True)
    
    # POD Notes & Voice Note
    notes = Column(String, nullable=True)
    pod_voice_note_url = Column(String, nullable=True)
    pod_voice_note_path = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    
    order = relationship("Order")
    customer = relationship("Customer")
    items = relationship("DispatchItem", back_populates="dispatch", cascade="all, delete-orphan")
    weights = relationship("Weight", back_populates="dispatch", cascade="all, delete-orphan")
    photos = relationship("Photo", back_populates="dispatch", cascade="all, delete-orphan")
    bill = relationship("Bill", back_populates="dispatch", uselist=False, cascade="all, delete-orphan")

class DispatchItem(Base):
    __tablename__ = "dispatch_items"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    product_name = Column(String, nullable=False)
    quantity = Column(Numeric, default=1, nullable=False)
    unit = Column(String, default="piece", nullable=False)
    price = Column(Numeric, default=0, nullable=True)
    discount_per_kg = Column(Numeric, default=0, nullable=True)
    discount_per_unit = Column(Numeric, default=0, nullable=True)
    discount_amount = Column(Numeric, default=0, nullable=True)
    original_price = Column(Numeric, nullable=True)
    
    dispatch = relationship("Dispatch", back_populates="items")

class Weight(Base):
    __tablename__ = "weights"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    actual_weight = Column(Numeric, nullable=False)
    weighed_at = Column(DateTime(timezone=True), server_default=text("now()"))
    notes = Column(String)
    
    dispatch = relationship("Dispatch", back_populates="weights")

class Photo(Base):
    __tablename__ = "photos"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String, nullable=False)
    caption = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    
    dispatch = relationship("Dispatch", back_populates="photos")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="SET NULL"), index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), index=True)
    customer_name = Column(String)
    image_url = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class Bill(Base):
    __tablename__ = "bills"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True, index=True)
    payment_method = Column(String, nullable=False)
    total_amount = Column(Numeric, default=0, nullable=False)
    discount_amount = Column(Numeric, default=0, nullable=False)
    paid_amount = Column(Numeric, default=0, nullable=False)
    pending_amount = Column(Numeric, default=0, nullable=False)
    prior_pending_paid = Column(Numeric, default=0, nullable=False)
    unloading_charge = Column(Numeric, default=0, nullable=False)
    delivery_charge = Column(Numeric, default=0, nullable=False)
    credit_due_date = Column(DateTime(timezone=True), nullable=True)
    credit_days = Column(Integer, nullable=True)
    is_today_payment_overdue = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

    dispatch = relationship("Dispatch", back_populates="bill")
    order = relationship("Order")
    customer = relationship("Customer")
    driver = relationship("Driver")

# New Tables for Billing Module
class Sale(Base):
    __tablename__ = "sales"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True) # Cashier
    total_amount = Column(Numeric, default=0, nullable=False)
    status = Column(String, default="completed", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric, default=1, nullable=False)
    unit_price = Column(Numeric, nullable=False)
    subtotal = Column(Numeric, nullable=False)
    
    sale = relationship("Sale", back_populates="items")

class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    total_amount = Column(Numeric, default=0, nullable=False)
    status = Column(String, default="completed", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")

class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    purchase_id = Column(UUID(as_uuid=True), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric, default=1, nullable=False)
    unit_cost = Column(Numeric, nullable=False)
    subtotal = Column(Numeric, nullable=False)
    
    purchase = relationship("Purchase", back_populates="items")

class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(String, nullable=False) # 'IN' or 'OUT'
    quantity = Column(Numeric, nullable=False)
    reference_id = Column(UUID(as_uuid=True), nullable=True, index=True) # Sale ID or Purchase ID
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"))

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    endpoint = Column(String, unique=True, nullable=False, index=True)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    user_role = Column(String, nullable=True)  # 'admin', 'billing', 'dispatch', 'all'
    user_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"))

class DriverHandover(Base):
    __tablename__ = "driver_handovers"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True, index=True)
    driver_name = Column(String, nullable=False)
    vehicle_number = Column(String, nullable=True)
    settlement_date = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    amount_in_hand = Column(Numeric, default=0, nullable=False)
    expected_amount = Column(Numeric, default=0, nullable=False)
    payment_mode = Column(String, default="cash", nullable=False)
    received_by = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"))

    driver = relationship("Driver")


