from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import DiscardedIngredientModel, IngredientModel, UserAccountModel
from app.schemas import BarcodeResult, DiscardRequest, DiscardedIngredientResponse, IngredientCreate, IngredientResponse, IngredientUpdate, WasteSummaryItem
from app.services.barcode import lookup_barcode
from app.services.freshness import days_until_expiry
from app.services.ingredients import ingredient_to_response, refresh_freshness
from app.services.normalize import normalize_ingredient_name

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("/barcode/{barcode}", response_model=BarcodeResult)
def barcode_lookup(
    barcode: str,
    current_user: UserAccountModel = Depends(get_current_user),
):
    result = lookup_barcode(barcode)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")

    # Use Groq to extract the base ingredient name if available
    ingredient_name = result["product_name"]
    try:
        from app.services.llm import _get_client
        client = _get_client()
        if client:
            msg = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                max_tokens=20,
                messages=[{
                    "role": "user",
                    "content": f"What is the primary ingredient in: '{result['product_name']}'? Reply with just the ingredient name, lowercase, 1-3 words only. Examples: 'milk', 'basmati rice', 'olive oil'."
                }],
            )
            extracted = msg.choices[0].message.content.strip().lower().strip("'\".,")
            if extracted:
                ingredient_name = extracted
    except Exception:
        pass

    return BarcodeResult(
        barcode=result["barcode"],
        product_name=result["product_name"],
        ingredient_name=ingredient_name,
        brand=result["brand"],
        quantity=result["quantity"],
        unit=result["unit"],
        nutrition_score=result["nutrition_score"],
    )


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


@router.post("/{ingredient_id}/discard", response_model=DiscardedIngredientResponse, status_code=201)
def discard_ingredient(
    ingredient_id: str,
    payload: DiscardRequest,
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
    record = DiscardedIngredientModel(
        user_id=current_user.id,
        ingredient_name=ing.name,
        normalized_name=ing.normalized_name,
        quantity=ing.quantity,
        unit=ing.unit,
        cost=ing.cost or 0.0,
        buy_date=ing.buy_date,
        expiry_date=ing.expiry_date,
        discard_reason=payload.reason,
    )
    db.add(record)
    db.delete(ing)
    db.commit()
    db.refresh(record)
    return record


@router.get("/discarded", response_model=list[DiscardedIngredientResponse])
def list_discarded(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    rows = (
        db.query(DiscardedIngredientModel)
        .filter(DiscardedIngredientModel.user_id == current_user.id)
        .order_by(DiscardedIngredientModel.discarded_at.desc())
        .limit(100)
        .all()
    )
    return rows


@router.get("/waste-summary", response_model=list[WasteSummaryItem])
def waste_summary(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    from sqlalchemy import func
    rows = (
        db.query(
            DiscardedIngredientModel.normalized_name,
            func.max(DiscardedIngredientModel.ingredient_name).label("ingredient_name"),
            func.count().label("discard_count"),
            func.sum(DiscardedIngredientModel.cost).label("total_cost"),
        )
        .filter(DiscardedIngredientModel.user_id == current_user.id)
        .group_by(DiscardedIngredientModel.normalized_name)
        .order_by(func.count().desc())
        .limit(10)
        .all()
    )
    return [
        WasteSummaryItem(
            normalized_name=r.normalized_name,
            ingredient_name=r.ingredient_name,
            discard_count=r.discard_count,
            total_cost=float(r.total_cost or 0),
        )
        for r in rows
    ]
