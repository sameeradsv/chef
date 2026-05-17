from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import IngredientModel, UserAccountModel
from app.schemas import IngredientCreate, IngredientResponse, IngredientUpdate
from app.services.freshness import days_until_expiry
from app.services.ingredients import ingredient_to_response, refresh_freshness
from app.services.normalize import normalize_ingredient_name

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("", response_model=list[IngredientResponse])
def list_ingredients(
    storage: str | None = Query(None),
    expiring_soon: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    q = db.query(IngredientModel).filter(IngredientModel.user_id == current_user.id)
    if storage:
        q = q.filter(IngredientModel.storage_type == storage)
    items = q.order_by(IngredientModel.expiry_date.asc().nullslast()).all()
    responses = [ingredient_to_response(i) for i in items]
    if expiring_soon:
        responses = [
            r
            for r in responses
            if r.days_until_expiry is not None and r.days_until_expiry <= 3
        ]
    return responses


@router.post("", response_model=IngredientResponse, status_code=201)
def create_ingredient(
    payload: IngredientCreate,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    ing = IngredientModel(
        user_id=current_user.id,
        name=payload.name,
        normalized_name=normalize_ingredient_name(payload.name),
        quantity=payload.quantity,
        unit=payload.unit,
        buy_date=payload.buy_date,
        expiry_date=payload.expiry_date,
        storage_type=payload.storage_type,
        opened=payload.opened,
        cost=payload.cost,
        brand=payload.brand,
    )
    refresh_freshness(ing)
    db.add(ing)
    db.commit()
    db.refresh(ing)
    return ingredient_to_response(ing)


@router.put("/{ingredient_id}", response_model=IngredientResponse)
def update_ingredient(
    ingredient_id: str,
    payload: IngredientUpdate,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    ing = (
        db.query(IngredientModel)
        .filter(IngredientModel.id == ingredient_id, IngredientModel.user_id == current_user.id)
        .first()
    )
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        ing.name = data["name"]
        ing.normalized_name = normalize_ingredient_name(data["name"])
    for k, v in data.items():
        if k != "name":
            setattr(ing, k, v)
    refresh_freshness(ing)
    db.commit()
    db.refresh(ing)
    return ingredient_to_response(ing)


@router.delete("/{ingredient_id}", status_code=204)
def delete_ingredient(
    ingredient_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    ing = (
        db.query(IngredientModel)
        .filter(IngredientModel.id == ingredient_id, IngredientModel.user_id == current_user.id)
        .first()
    )
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    db.delete(ing)
    db.commit()
