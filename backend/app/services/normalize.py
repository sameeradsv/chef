import re

ALIASES: dict[str, str] = {
    "tomatoes": "tomato",
    "tamatar": "tomato",
    "paneer": "paneer",
    "tofu": "tofu",
    "onions": "onion",
    "pyaaz": "onion",
    "spinach": "spinach",
    "palak": "spinach",
    "rice": "rice",
    "chawal": "rice",
    "eggs": "egg",
    "anda": "egg",
    "potatoes": "potato",
    "aloo": "potato",
    "curd": "yogurt",
    "dahi": "yogurt",
    "cream": "cream",
    "milk": "milk",
    "doodh": "milk",
    "chicken": "chicken",
    "lentils": "lentil",
    "dal": "lentil",
    "garlic": "garlic",
    "ginger": "ginger",
    "cumin": "cumin",
    "turmeric": "turmeric",
    "haldi": "turmeric",
    "butter": "butter",
    "oil": "oil",
    "bread": "bread",
    "capsicum": "bell_pepper",
    "bell pepper": "bell_pepper",
}


def normalize_ingredient_name(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\s]", "", name.lower().strip())
    cleaned = re.sub(r"\s+", " ", cleaned)
    if cleaned in ALIASES:
        return ALIASES[cleaned]
    for key, val in ALIASES.items():
        if key in cleaned or cleaned in key:
            return val
    return cleaned.replace(" ", "_")
