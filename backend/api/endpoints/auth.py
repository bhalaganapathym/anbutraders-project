from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core import security
from core.config import settings
from db.session import SessionLocal
from api.deps import get_db
from models.all import User
from schemas.all import Token, UserCreate, UserResponse, PasswordResetRequest

router = APIRouter()

from sqlalchemy import func

@router.post("/login/access-token", response_model=Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
):
    identifier = form_data.username.strip().lower()
    user = db.query(User).filter(
        (func.lower(User.username) == identifier) | (func.lower(User.email) == identifier)
    ).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="User account not found")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    # Billing and Dispatch roles do not require a password to enter
    if user.role not in ["billing", "dispatch"]:
        if not form_data.password or not security.verify_password(form_data.password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Incorrect password")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/register", response_model=UserResponse)
def register_user(
    user_in: UserCreate, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        role=user_in.role,
        secret_question=user_in.secret_question,
        secret_answer_hash=security.get_password_hash(user_in.secret_answer.lower()) if user_in.secret_answer else None
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/reset-password")
def reset_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    if not user.secret_answer_hash:
        raise HTTPException(status_code=400, detail="No secret question configured for this user")
    if not security.verify_password(req.secret_answer.lower(), user.secret_answer_hash):
        raise HTTPException(status_code=400, detail="Incorrect secret answer")
    
    user.hashed_password = security.get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

from api.deps import get_current_active_user

@router.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user
