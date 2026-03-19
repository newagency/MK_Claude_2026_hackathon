from collections import defaultdict
from fastapi import APIRouter
from app.services.collectors.mock_loader import MockGarakLoader
from app.services.collectors.fair_price import PriceForensics

router = APIRouter()

COMMODITY_META = {
    "111": {"name": "쌀",    "emoji": "🌾", "en": "Rice"},
    "115": {"name": "밀가루", "emoji": "🌾", "en": "Flour"},
    "211": {"name": "고구마", "emoji": "🍠", "en": "Sweet Potato"},
    "215": {"name": "대파",   "emoji": "🌿", "en": "Green Onion"},
    "312": {"name": "닭고기", "emoji": "🍗", "en": "Chicken"},
    "431": {"name": "식용유", "emoji": "🫙", "en": "Cooking Oil"},
}


@router.get("/commodities")
def get_commodities_overview():
    """
    Returns current vs. 3-year-average prices and rocket-feather analysis
    for all tracked commodities, sorted by price deviation (highest first).
    """
    data = MockGarakLoader.get_5year_data()

    groups: dict[str, list] = defaultdict(list)
    for entry in data:
        groups[entry["item_code"]].append(entry)

    result = []
    for code, entries in groups.items():
        sorted_entries = sorted(entries, key=lambda x: x["search_date"])
        latest = sorted_entries[-1]

        valid = [e for e in entries if e.get("avg_price_y1", 0) > 0]
        if valid:
            avg_3year = sum(
                (e["avg_price_y1"] + e["avg_price_y2"] + e["avg_price_y3"]) / 3
                for e in valid
            ) / len(valid)
        else:
            avg_3year = latest["avg_price_current"]

        current = latest["avg_price_current"]
        delta_pct = round((current - avg_3year) / avg_3year * 100, 1)

        rocket_feather = PriceForensics.detect_rocket_feather(sorted_entries)

        if delta_pct > 20 or rocket_feather["is_feather"]:
            risk = "high"
        elif delta_pct > 8:
            risk = "medium"
        else:
            risk = "low"

        meta = COMMODITY_META.get(code, {"name": code, "emoji": "📦", "en": code})

        result.append({
            "item_code": code,
            "item_name": meta["name"],
            "emoji": meta["emoji"],
            "en_name": meta["en"],
            "unit": latest["unit"],
            "current_price": current,
            "avg_3year": int(avg_3year),
            "price_delta_pct": delta_pct,
            "greedflation_risk": risk,
            "rocket_feather": rocket_feather,
            "trend": [
                {"date": e["search_date"][4:], "price": e["avg_price_current"]}
                for e in sorted_entries
            ],
            "note": latest.get("note", ""),
        })

    return sorted(result, key=lambda x: abs(x["price_delta_pct"]), reverse=True)
