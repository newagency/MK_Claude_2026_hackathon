import json
import os

def _resolve_data_dir() -> str:
    # Allow override via env variable (used in Docker)
    env = os.getenv("DATA_DIR")
    if env:
        return env
    # Walk up from this file until we find a 'data/' sibling directory
    current = os.path.dirname(os.path.abspath(__file__))
    for _ in range(10):
        candidate = os.path.join(current, "data")
        if os.path.isdir(candidate):
            return candidate
        current = os.path.dirname(current)
    raise RuntimeError("Could not locate 'data/' directory")

DATA_DIR = _resolve_data_dir()


class MockGarakLoader:
    @staticmethod
    def get_5year_data() -> list:
        file_path = os.path.join(DATA_DIR, "mock_garak_5years.json")
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def get_price_trend(item_code: str) -> list:
        data = MockGarakLoader.get_5year_data()
        return [d for d in data if d["item_code"] == item_code]
