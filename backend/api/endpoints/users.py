from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID

from api.deps import get_db, get_current_admin_user
from core import security
from models.all import User
from schemas.all import UserCreate, UserUpdate, UserResponse, AdminResetPasswordRequest
from api.endpoints.ws import manager

router = APIRouter()

@router.get("", response_model=List[UserResponse])
def list_users(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    query = db.query(User)
    if role:
        query = query.filter(func.lower(User.role) == role.lower())
    return query.order_by(User.role.asc(), User.username.asc()).all()

@router.post("", response_model=UserResponse)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    clean_username = user_in.username.strip().lower()
    clean_email = (user_in.email or f"{clean_username}@anbu.com").strip().lower()

    existing_user = db.query(User).filter(
        (func.lower(User.username) == clean_username) | (func.lower(User.email) == clean_email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="A user with this username or email already exists"
        )

    user = User(
        username=clean_username,
        full_name=user_in.full_name or user_in.username.title(),
        email=clean_email,
        hashed_password=security.get_password_hash(user_in.password),
        role=(user_in.role or "billing").lower(),
        secret_question=user_in.secret_question or "What is your favorite color?",
        secret_answer_hash=security.get_password_hash(user_in.secret_answer.lower() if user_in.secret_answer else "blue"),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/{id}", response_model=UserResponse)
def update_user(
    id: UUID,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role is not None:
        user.role = user_in.role.lower()
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password:
        user.hashed_password = security.get_password_hash(user_in.password)

    db.commit()
    db.refresh(user)
    return user

@router.post("/{id}/reset-password")
def admin_reset_password(
    id: UUID,
    req: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not req.new_password or len(req.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    user.hashed_password = security.get_password_hash(req.new_password.strip())
    db.commit()
    return {"status": "success", "message": f"Password reset for {user.username}"}

@router.delete("/{id}")
def delete_user(
    id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id or user.username.lower() == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin account")

    db.delete(user)
    db.commit()
    return {"status": "success", "message": f"User {user.username} deleted"}
