from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models import UserAccountModel

router = APIRouter(prefix="/vision", tags=["vision"])

_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


class VisionParseRequest(BaseModel):
    image_base64: str
    image_type: str = "jpeg"  # jpeg | png | webp
    parse_type: str            # "order" | "ingredients"


def _extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


@router.post("/parse")
def parse_image(
    payload: VisionParseRequest,
    current_user: UserAccountModel = Depends(get_current_user),
) -> Dict[str, Any]:
    if payload.parse_type not in ("order", "ingredients", "product"):
        raise HTTPException(status_code=400, detail="parse_type must be 'order', 'ingredients', or 'product'")

    try:
        from app.services.llm import _get_client
        client = _get_client()
    except Exception:
        client = None

    if not client:
        raise HTTPException(status_code=503, detail="Vision service unavailable — GROQ_API_KEY not configured")

    mime = f"image/{payload.image_type}"
    data_uri = f"data:{mime};base64,{payload.image_base64}"

    try:
        if payload.parse_type == "order":
            return _parse_order(client, data_uri)
        if payload.parse_type == "product":
            return _parse_product(client, data_uri)
        return _parse_ingredients(client, data_uri)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Vision parsing failed: {exc}")


def _parse_order(client: Any, data_uri: str) -> Dict[str, Any]:
    prompt = (
        "You are looking at a food order screenshot (Swiggy, Zomato, restaurant bill, or food photo).\n\n"
        "Extract the information and respond ONLY with this JSON (no markdown, no extra text):\n"
        '{"decision":"order","meal_name":null,"cuisine":null,"restaurant_name":null,"timestamp":null}\n\n'
        "Rules:\n"
        '- decision: "order" for delivery/takeaway, "eat_out" for dine-in, "cook" if it\'s a recipe\n'
        "- meal_name: primary dish name (null if unclear)\n"
        "- cuisine: e.g. Indian, Chinese, Italian (null if unclear)\n"
        "- restaurant_name: restaurant or platform name (null if unclear)\n"
        "- timestamp: IST datetime if visible, e.g. 2024-05-24T18:30:00 (no timezone suffix; null if not visible)\n"
        "Return only the JSON object."
    )

    response = client.chat.completions.create(
        model=_VISION_MODEL,
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_uri}},
                {"type": "text", "text": prompt},
            ],
        }],
    )

    data = _extract_json(response.choices[0].message.content.strip())
    return {
        "type": "order",
        "decision": data.get("decision", "order"),
        "meal_name": data.get("meal_name") or None,
        "cuisine": data.get("cuisine") or None,
        "restaurant_name": data.get("restaurant_name") or None,
        "timestamp": data.get("timestamp") or None,
    }


def _parse_ingredients(client: Any, data_uri: str) -> Dict[str, Any]:
    prompt = (
        "You are looking at an image that may show ingredients (grocery receipt, pantry shelf, recipe card, or food packaging).\n\n"
        "Extract all ingredients and respond ONLY with this JSON (no markdown, no extra text):\n"
        '{"items":[{"name":"ingredient lowercase","quantity":500,"unit":"grams"}]}\n\n'
        "Rules:\n"
        "- name: lowercase basic ingredient name (e.g. 'basmati rice', not 'Premium Basmati 5kg')\n"
        "- quantity: numeric amount (null if not visible)\n"
        "- unit: grams, kg, ml, liters, pieces, cups, tbsp, tsp (null if not visible)\n"
        "- If no ingredients visible, return {\"items\":[]}\n"
        "Return only the JSON object."
    )

    response = client.chat.completions.create(
        model=_VISION_MODEL,
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_uri}},
                {"type": "text", "text": prompt},
            ],
        }],
    )

    data = _extract_json(response.choices[0].message.content.strip())
    raw_items: List[Dict[str, Any]] = data.get("items", [])
    return {
        "type": "ingredients",
        "items": [
            {
                "name": item.get("name", "").strip(),
                "quantity": item.get("quantity"),
                "unit": item.get("unit") or None,
            }
            for item in raw_items
            if item.get("name", "").strip()
        ],
    }


def _parse_product(client: Any, data_uri: str) -> Dict[str, Any]:
    prompt = (
        "You are looking at a packaged food product (label, box, bottle, or pouch).\n\n"
        "Extract product details and respond ONLY with this JSON (no markdown, no extra text):\n"
        '{"name":null,"brand":null,"quantity":null,"unit":null,"expiry_date":null,"price":null,"storage_type":"pantry"}\n\n'
        "Rules:\n"
        "- name: product name in title case (e.g. 'Amul Butter', 'Tata Salt', 'Maggi Noodles')\n"
        "- brand: brand name only (null if unclear)\n"
        "- quantity: numeric pack size only (e.g. 500 for a 500g pack, 1 for a 1L bottle)\n"
        "- unit: grams, kg, ml, liters, pieces — match the label unit exactly\n"
        "- expiry_date: ISO YYYY-MM-DD from any 'Best Before', 'Exp', 'Use By' date visible; "
        "if only month/year given (e.g. 08/2025) use last day of that month (2025-08-31); null if not visible\n"
        "- price: MRP or printed price as a plain number in rupees (e.g. 65 for ₹65); null if not visible\n"
        "- storage_type: 'fridge' for dairy/meat/eggs/fresh produce/paneer/curd/butter/cheese; "
        "'freezer' for anything labelled frozen; 'pantry' for everything else\n"
        "Return only the JSON object."
    )

    response = client.chat.completions.create(
        model=_VISION_MODEL,
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_uri}},
                {"type": "text", "text": prompt},
            ],
        }],
    )

    data = _extract_json(response.choices[0].message.content.strip())
    return {
        "type": "product",
        "name": (data.get("name") or "").strip() or None,
        "brand": (data.get("brand") or "").strip() or None,
        "quantity": data.get("quantity"),
        "unit": (data.get("unit") or "").strip() or None,
        "expiry_date": (data.get("expiry_date") or "").strip() or None,
        "price": data.get("price"),
        "storage_type": data.get("storage_type") or "pantry",
    }
