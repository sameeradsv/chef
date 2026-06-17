from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth_utils import create_session, hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models import AuthSessionModel, UserAccountModel
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserAccountResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("3/minute")
def register(request: Request, payload: RegisterRequest = Body(), db: Session = Depends(get_db)):
    username = payload.username.lower()
    if db.scalar(select(UserAccountModel.id).where(UserAccountModel.username == username)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    user = UserAccountModel(
        username=username,
        hashed_passcode=hash_password(payload.passcode),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    session = create_session(db, user)
    return TokenResponse(token=session.token, user=UserAccountResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest = Body(), db: Session = Depends(get_db)):
    user = db.scalar(select(UserAccountModel).where(UserAccountModel.username == payload.username.lower()))
    if not user or not verify_password(payload.passcode, user.hashed_passcode):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or passcode")
    session = create_session(db, user)
    return TokenResponse(token=session.token, user=UserAccountResponse.model_validate(user))


@router.delete("/logout", status_code=204)
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    _user: UserAccountModel = Depends(get_current_user),
):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        db.execute(delete(AuthSessionModel).where(AuthSessionModel.token == token))
        db.commit()


@router.get("/me", response_model=UserAccountResponse)
def me(current_user: UserAccountModel = Depends(get_current_user)):
    return current_user


@router.get("/status")
def status_check(db: Session = Depends(get_db)):
    has_users = db.scalar(select(UserAccountModel.id).limit(1)) is not None
    return {"has_users": has_users}


@router.delete("/account", status_code=204)
def delete_account(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    db.delete(current_user)
    db.commit()
