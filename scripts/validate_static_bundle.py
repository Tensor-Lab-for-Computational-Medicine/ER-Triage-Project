"""Validate the static browser case bundle used by the Vite app."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CASE_BUNDLE = ROOT / "frontend" / "src" / "data" / "cases.json"
REQUIRED_TOP_LEVEL = {
    "id",
    "demographics",
    "complaint",
    "vitals",
    "history",
    "acuity",
    "disposition",
    "interventions",
    "resources_used",
}
REQUIRED_VITALS = {"temp", "hr", "rr", "o2", "sbp", "dbp", "pain"}


def main() -> None:
    cases = json.loads(CASE_BUNDLE.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        raise SystemExit("Case bundle must be a non-empty list.")

    ids = set()
    for index, case in enumerate(cases, start=1):
        missing = REQUIRED_TOP_LEVEL - set(case)
        if missing:
            raise SystemExit(f"Case {index} is missing fields: {sorted(missing)}")

        if case["id"] in ids:
            raise SystemExit(f"Duplicate case id: {case['id']}")
        ids.add(case["id"])

        if set(case["vitals"]) != REQUIRED_VITALS:
            raise SystemExit(f"Case {case['id']} has unexpected vital fields.")

        if not 1 <= int(case["acuity"]) <= 5:
            raise SystemExit(f"Case {case['id']} has invalid ESI acuity.")

        if "expert_opinions" in case or "final_decision" in case:
            raise SystemExit(f"Case {case['id']} exposes expert adjudication fields.")

    print(f"Validated {len(cases)} static cases.")


if __name__ == "__main__":
    main()
