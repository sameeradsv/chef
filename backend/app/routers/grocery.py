from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import GroceryItemModel, UserAccountModel
from app.schemas import GroceryItemCreate, GroceryItemResponse, GroceryItemUpdate
from app.services.grocery import get_grocery_suggestions

router = APIRouter(prefix="/grocery", tags=["grocery"])


@router.get("/suggestions", response_model=list[str])
def suggestions(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    return get_grocery_suggestions(current_user.id, db)


@router.get("", response_model=list[GroceryItemResponse])
def list_items(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    return (
        db.query(GroceryItemModel)
        .filter(GroceryItemModel.user_id == current_user.id)
        .order_by(GroceryItemModel.added_at.desc())
        .all()
    )


@router.post("", response_model=GroceryItemResponse, status_code=201)
def add_item(
    payload: GroceryItemCreate,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    item = GroceryItemModel(
        user_id=current_user.id,
        ingredient_name=payload.ingredient_name,
        quantity=payload.quantity,
        unit=payload.unit,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=GroceryItemResponse)
def update_item(
    item_id: str,
    payload: GroceryItemUpdate,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    item = (
        db.query(GroceryItemModel)
        .filter(GroceryItemModel.id == item_id, GroceryItemModel.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    item = (
        db.query(GroceryItemModel)
        .filter(GroceryItemModel.id == item_id, GroceryItemModel.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
