from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID

# Token
class Token(BaseModel):
    access_token: str
    token_type: str

# User
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = "Cashier"
    secret_question: Optional[str] = None
    secret_answer: Optional[str] = None

class PasswordResetRequest(BaseModel):
    username: str
    secret_answer: str
    new_password: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    role: str
    is_active: bool
    
    class Config:
        from_attributes = True

# Customer
class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    delivery_addresses: Optional[List[str]] = []

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: UUID
    pending_amount: Optional[float] = 0.0
    credit_due_date: Optional[datetime] = None
    credit_days: Optional[int] = None
    credit_days_remaining: Optional[int] = None
    credit_status: Optional[str] = 'clear'
    created_at: datetime
    
    class Config:
        from_attributes = True

# Supplier
class SupplierBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

# Product
class ProductBase(BaseModel):
    name: str
    category: str
    unit: Optional[str] = 'piece'
    stock_qty: Optional[float] = 0
    price: Optional[float] = 0
    brand: Optional[str] = None
    size: Optional[str] = None
    standard_weight: Optional[float] = 0
    weight_tolerance: Optional[float] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

class BrandPriceAdjustRequest(BaseModel):
    brand: str
    price_delta: float
        
# Sales
class SaleItemCreate(BaseModel):
    product_id: UUID
    quantity: float
    unit_price: float

class SaleCreate(BaseModel):
    customer_id: UUID
    items: List[SaleItemCreate]

class SaleItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    quantity: float
    unit_price: float
    subtotal: float
    
    class Config:
        from_attributes = True

class SaleResponse(BaseModel):
    id: UUID
    customer_id: UUID
    user_id: Optional[UUID]
    total_amount: float
    status: str
    created_at: datetime
    items: List[SaleItemResponse]
    
    class Config:
        from_attributes = True

# Purchases
class PurchaseItemCreate(BaseModel):
    product_id: UUID
    quantity: float
    unit_cost: float

class PurchaseCreate(BaseModel):
    supplier_id: UUID
    items: List[PurchaseItemCreate]

class PurchaseItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    quantity: float
    unit_cost: float
    subtotal: float
    
    class Config:
        from_attributes = True

class PurchaseResponse(BaseModel):
    id: UUID
    supplier_id: UUID
    user_id: Optional[UUID]
    total_amount: float
    status: str
    created_at: datetime
    items: List[PurchaseItemResponse]
    
    class Config:
        from_attributes = True

# Dispatches
class DispatchItemCreate(BaseModel):
    product_id: UUID
    product_name: str
    quantity: float
    unit: str
    price: Optional[float] = 0
    discount_per_kg: Optional[float] = 0
    discount_per_unit: Optional[float] = 0
    discount_amount: Optional[float] = 0
    original_price: Optional[float] = None

class DispatchItemResponse(BaseModel):
    id: UUID
    dispatch_id: UUID
    product_id: UUID
    product_name: str
    quantity: float
    unit: str
    price: Optional[float] = 0
    discount_per_kg: Optional[float] = 0
    discount_per_unit: Optional[float] = 0
    discount_amount: Optional[float] = 0
    original_price: Optional[float] = None
    class Config:
        from_attributes = True

class WeightCreate(BaseModel):
    actual_weight: float
    notes: Optional[str] = None

class WeightResponse(BaseModel):
    id: UUID
    dispatch_id: UUID
    actual_weight: float
    weighed_at: datetime
    notes: Optional[str] = None
    class Config:
        from_attributes = True

class PhotoCreate(BaseModel):
    url: str
    caption: Optional[str] = None

class PhotoResponse(BaseModel):
    id: UUID
    dispatch_id: UUID
    url: str
    caption: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class DiscountItemInput(BaseModel):
    item_id: UUID
    product_name: Optional[str] = None
    discount_type: str  # 'per_kg', 'per_unit', 'flat'
    discount_value: float
    discount_amount: float
    original_price: Optional[float] = None
    new_price: float

class DiscountApprovalRequest(BaseModel):
    items: List[DiscountItemInput]
    total_discount: float
    reason: Optional[str] = None
    requested_by: Optional[str] = "Cashier"

class DiscountDecisionRequest(BaseModel):
    decision: str  # 'approved' or 'rejected'
    approved_by: Optional[str] = "Admin"
    rejection_reason: Optional[str] = None

class DispatchCreate(BaseModel):
    dispatch_no: str
    order_id: UUID
    customer_id: UUID
    delivery_address: Optional[str] = None
    status: Optional[str] = "pending"
    vehicle_id: Optional[UUID] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    phase1_draft: Optional[Any] = None
    mismatch_approval_status: Optional[str] = None
    mismatch_voice_note_url: Optional[str] = None
    mismatch_voice_note_path: Optional[str] = None
    mismatch_reason: Optional[str] = None
    mismatch_requested_at: Optional[datetime] = None
    mismatch_approved_by: Optional[str] = None
    mismatch_approved_at: Optional[datetime] = None
    mismatch_rejection_reason: Optional[str] = None
    discount_amount: Optional[float] = 0
    discount_reason: Optional[str] = None
    discount_approval_status: Optional[str] = None
    discount_requested_by: Optional[str] = None
    discount_approved_by: Optional[str] = None
    discount_requested_at: Optional[datetime] = None
    discount_approved_at: Optional[datetime] = None
    discount_rejection_reason: Optional[str] = None
    discount_details: Optional[Any] = None
    items: Optional[List[DispatchItemCreate]] = []
    weights: Optional[List[WeightCreate]] = []
    photos: Optional[List[PhotoCreate]] = []

class DispatchDraftUpdate(BaseModel):
    phase1_draft: Any

class WeightMismatchDecision(BaseModel):
    decision: str  # 'approved' or 'rejected'
    approved_by: Optional[str] = "Admin"
    rejection_reason: Optional[str] = None

class DispatchResponse(BaseModel):
    id: UUID
    dispatch_no: str
    order_id: UUID
    customer_id: UUID
    status: str
    delivery_address: Optional[str] = None
    vehicle_id: Optional[UUID] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    phase1_draft: Optional[Any] = None
    mismatch_approval_status: Optional[str] = None
    mismatch_voice_note_url: Optional[str] = None
    mismatch_voice_note_path: Optional[str] = None
    mismatch_reason: Optional[str] = None
    mismatch_requested_at: Optional[datetime] = None
    mismatch_approved_by: Optional[str] = None
    mismatch_approved_at: Optional[datetime] = None
    mismatch_rejection_reason: Optional[str] = None
    discount_amount: Optional[float] = 0
    discount_reason: Optional[str] = None
    discount_approval_status: Optional[str] = None
    discount_requested_by: Optional[str] = None
    discount_approved_by: Optional[str] = None
    discount_requested_at: Optional[datetime] = None
    discount_approved_at: Optional[datetime] = None
    discount_rejection_reason: Optional[str] = None
    discount_details: Optional[Any] = None
    sent_to_billing_at: Optional[datetime] = None
    ready_for_loading_at: Optional[datetime] = None
    loading_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    vehicle_leave_photo_url: Optional[str] = None
    dispatch_team: Optional[str] = None
    created_at: datetime
    
    order: Optional["OrderResponse"] = None
    customer: Optional[CustomerResponse] = None
    items: List[DispatchItemResponse] = []
    weights: List[WeightResponse] = []
    photos: List[PhotoResponse] = []
    bill: Optional["BillResponse"] = None
    
    class Config:
        from_attributes = True

# Orders
class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: float
    unit: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: UUID
    order_id: UUID
    product_id: UUID
    quantity: float
    unit: Optional[str] = None
    product: Optional[ProductResponse] = None
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_id: UUID
    order_no: Optional[str] = None
    delivery_address: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "pending"
    is_advance_order: Optional[bool] = False
    scheduled_delivery_date: Optional[datetime] = None
    advance_paid_amount: Optional[float] = 0.0
    advance_payment_method: Optional[str] = None
    advance_notes: Optional[str] = None
    advance_status: Optional[str] = "pending"
    items: Optional[List[OrderItemCreate]] = []

class OrderResponse(BaseModel):
    id: UUID
    order_no: Optional[str] = None
    customer_id: UUID
    status: str
    delivery_address: Optional[str] = None
    notes: Optional[str] = None
    is_advance_order: Optional[bool] = False
    scheduled_delivery_date: Optional[datetime] = None
    advance_paid_amount: Optional[float] = 0.0
    advance_payment_method: Optional[str] = None
    advance_notes: Optional[str] = None
    advance_status: Optional[str] = "pending"
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    
    customer: Optional[CustomerResponse] = None
    items: List[OrderItemResponse] = []
    
    class Config:
        from_attributes = True

class NotificationCreate(BaseModel):
    type: str
    title: str
    message: str
    dispatch_id: Optional[UUID] = None
    order_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    image_url: Optional[str] = None
    read: Optional[bool] = False

class NotificationResponse(NotificationCreate):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

# Drivers
class DriverCreate(BaseModel):
    name: str
    phone_number: str
    vehicle_number: Optional[str] = None
    status: Optional[str] = 'free'

class DriverResponse(BaseModel):
    id: UUID
    name: str
    phone_number: str
    vehicle_number: Optional[str] = None
    status: Optional[str] = 'free'
    class Config:
        from_attributes = True

# Bills
class BillCreate(BaseModel):
    dispatch_id: UUID
    order_id: UUID
    customer_id: UUID
    driver_id: Optional[UUID] = None
    payment_method: str
    total_amount: float
    discount_amount: Optional[float] = 0.0
    paid_amount: Optional[float] = 0.0
    pending_amount: Optional[float] = 0.0
    credit_due_date: Optional[datetime] = None
    credit_days: Optional[int] = None
    is_today_payment_overdue: Optional[bool] = False
    notes: Optional[str] = None

class BillResponse(BaseModel):
    id: UUID
    dispatch_id: UUID
    order_id: UUID
    customer_id: UUID
    driver_id: Optional[UUID] = None
    payment_method: str
    total_amount: float
    discount_amount: float = 0.0
    paid_amount: float = 0.0
    pending_amount: float = 0.0
    credit_due_date: Optional[datetime] = None
    credit_days: Optional[int] = None
    is_today_payment_overdue: bool = False
    notes: Optional[str] = None
    created_at: datetime
    
    driver: Optional[DriverResponse] = None
    
    class Config:
        from_attributes = True

class SystemSettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None

class SystemSettingResponse(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BulkDeleteRequest(BaseModel):
    ids: List[UUID]

