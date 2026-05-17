from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import ALGORITHM, SECRET_KEY, get_current_user
from app.models import UserAccountModel
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserAccountResponse

from jose import jwt

router = APIRouter(prefix="/auth", tags=["auth"])

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
TOKEN_EXPIRE_DAYS = 30


def _make_token(user_id: str) -> str:
    exp = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = (
        db.query(UserAccountModel)
        .filter(UserAccountModel.username == payload.username)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )
    user = UserAccountModel(
        username=payload.username,
        hashed_passcode=_pwd.hash(payload.passcode),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=_make_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(UserAccountModel)
        .filter(UserAccountModel.username == payload.username.lower())
        .first()
    )
    if not user or not _pwd.verify(payload.passcode, user.hashed_passcode):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or passcode",
        )
    return TokenResponse(access_token=_make_token(user.id))


@router.get("/me", response_model=UserAccountResponse)
def me(current_user: UserAccountModel = Depends(get_current_user)):
    return current_user
