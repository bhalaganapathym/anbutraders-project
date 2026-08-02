from pydantic import BaseModel, EmailStr
from typing import Optional, List
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

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: UUID
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

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True
        
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

class DispatchItemResponse(BaseModel):
    id: UUID
    dispatch_id: UUID
    product_id: UUID
    product_name: str
    quantity: float
    unit: str
    price: Optional[float] = 0
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
    items: Optional[List[DispatchItemCreate]] = []
    weights: Optional[List[WeightCreate]] = []
    photos: Optional[List[PhotoCreate]] = []

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
    loading_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    dispatch_team: Optional[str] = None
    created_at: datetime
    
    customer: Optional[CustomerResponse] = None
    items: List[DispatchItemResponse] = []
    weights: List[WeightResponse] = []
    photos: List[PhotoResponse] = []
    
    class Config:
        from_attributes = True

# Orders
class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: float

class OrderItemResponse(BaseModel):
    id: UUID
    order_id: UUID
    product_id: UUID
    quantity: float
    product: Optional[ProductResponse] = None
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_id: UUID
    delivery_address: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "pending"
    items: Optional[List[OrderItemCreate]] = []

class OrderResponse(BaseModel):
    id: UUID
    customer_id: UUID
    status: str
    delivery_address: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    
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
