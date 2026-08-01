from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.deps import get_db, get_current_active_user
from models.all import Sale, SaleItem, Purchase, PurchaseItem, StockMovement, Product, User
from schemas.all import SaleCreate, SaleResponse, PurchaseCreate, PurchaseResponse
import uuid

router = APIRouter()

@router.post("/sales", response_model=SaleResponse)
def create_sale(
    sale_in: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        # 1. Create Sale record
        sale = Sale(
            customer_id=sale_in.customer_id,
            user_id=current_user.id,
            total_amount=0 # Will calculate
        )
        db.add(sale)
        db.flush() # Get sale.id
        
        total_amount = 0
        
        # 2. Process Items
        for item_in in sale_in.items:
            # Check stock
            product = db.query(Product).filter(Product.id == item_in.product_id).with_for_update().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item_in.product_id} not found")
            
            if product.stock_qty < item_in.quantity:
                raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")
            
            # Deduct stock
            product.stock_qty -= item_in.quantity
            
            # Create SaleItem
            subtotal = item_in.quantity * item_in.unit_price
            total_amount += subtotal
            
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                quantity=item_in.quantity,
                unit_price=item_in.unit_price,
                subtotal=subtotal
            )
            db.add(sale_item)
            
            # Create StockMovement
            movement = StockMovement(
                product_id=product.id,
                movement_type="OUT",
                quantity=item_in.quantity,
                reference_id=sale.id
            )
            db.add(movement)
            
        sale.total_amount = total_amount
        db.commit()
        db.refresh(sale)
        return sale
    except Exception as e:
        db.rollback()
        raise e

@router.post("/purchases", response_model=PurchaseResponse)
def create_purchase(
    purchase_in: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        purchase = Purchase(
            supplier_id=purchase_in.supplier_id,
            user_id=current_user.id,
            total_amount=0
        )
        db.add(purchase)
        db.flush()
        
        total_amount = 0
        for item_in in purchase_in.items:
            product = db.query(Product).filter(Product.id == item_in.product_id).with_for_update().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item_in.product_id} not found")
            
            product.stock_qty += item_in.quantity
            
            subtotal = item_in.quantity * item_in.unit_cost
            total_amount += subtotal
            
            purchase_item = PurchaseItem(
                purchase_id=purchase.id,
                product_id=product.id,
                quantity=item_in.quantity,
                unit_cost=item_in.unit_cost,
                subtotal=subtotal
            )
            db.add(purchase_item)
            
            movement = StockMovement(
                product_id=product.id,
                movement_type="IN",
                quantity=item_in.quantity,
                reference_id=purchase.id
            )
            db.add(movement)
            
        purchase.total_amount = total_amount
        db.commit()
        db.refresh(purchase)
        return purchase
    except Exception as e:
        db.rollback()
        raise e
