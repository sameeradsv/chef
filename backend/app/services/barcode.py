from __future__ import annotations

import re

import httpx

OFF_BASE = "https://world.openfoodfacts.org/api/v2/product"
_TIMEOUT = 6.0


def _parse_quantity(raw: str) -> tuple[float, str]:
    m = re.match(r"([\d.]+)\s*([a-zA-Z]+)", raw.strip())
    if not m:
        return 1.0, "piece"
    qty, unit = float(m.group(1)), m.group(2).lower()
    if unit == "kg":
        qty *= 1000; unit = "grams"
    elif unit in ("g", "gm", "gr"):
        unit = "grams"
    elif unit in ("l", "litre", "liter"):
        qty *= 1000; unit = "ml"
    return qty, unit


def _nutrition_score(nutriments: dict) -> float:
    if not nutriments:
        return 5.0
    protein = float(nutriments.get("proteins_100g") or 0)
    fiber   = float(nutriments.get("fiber_100g") or 0)
    sugar   = float(nutriments.get("sugars_100g") or 0)
    fat     = float(nutriments.get("fat_100g") or 0)
    score   = 5.0
    score  += min(protein / 5, 2.0)
    score  += min(fiber / 5, 1.5)
    score  -= min(sugar / 15, 2.0)
    score  -= min(max(fat - 10, 0) / 20, 1.0)
    return round(max(1.0, min(10.0, score)), 1)


def lookup_barcode(barcode: str) -> dict | None:
    """Call Open Food Facts. Returns product dict or None if not found."""
    try:
        resp = httpx.get(
            f"{OFF_BASE}/{barcode}.json",
            params={"fields": "product_name,brands,quantity,nutriments"},
            timeout=_TIMEOUT,
            headers={"User-Agent": "Chef-Kitchen-App/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    if data.get("status") != 1:
        return None

    product = data.get("product", {})
    product_name = (product.get("product_name") or "").strip()
    if not product_name:
        return None

    brand     = (product.get("brands") or "").split(",")[0].strip()
    raw_qty   = (product.get("quantity") or "").strip()
    qty, unit = _parse_quantity(raw_qty) if raw_qty else (1.0, "piece")

    return {
        "barcode": barcode,
        "product_name": product_name,
        "brand": brand,
        "quantity": qty,
        "unit": unit,
        "nutrition_score": _nutrition_score(product.get("nutriments") or {}),
    }
