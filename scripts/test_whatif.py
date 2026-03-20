"""Simple smoke test for the /api/v1/what-if logic.

Run inside the backend container (recommended):

    docker compose run --rm backend \
        python scripts/test_whatif.py

This example queries the 2025-06-08 baseline with dummy toolbar inputs.
"""

from __future__ import annotations

import json
from datetime import date

from app.api.whatif import WhatIfRequest, run_what_if


def main() -> None:
    req = WhatIfRequest(
        target_date=date(2025, 6, 8),
        exchange_rate_krw=1400.0,
        oil_price_usd=1500.0,
        min_wage_change_pct=3.0,
    )
    result = run_what_if(req)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
