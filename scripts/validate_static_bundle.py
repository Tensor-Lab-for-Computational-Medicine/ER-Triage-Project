"""Validate the reviewed static browser case bundle used by the Vite app."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CASE_BUNDLE = ROOT / "frontend" / "src" / "data" / "cases.json"

REQUIRED_TOP_LEVEL = {
    "schema_version",
    "id",
    "demographics",
    "complaint",
    "vitals",
    "history",
    "acuity",
    "disposition",
    "interventions",
    "resources_used",
    "source",
    "documented_evidence",
    "missing_evidence",
    "augmentation",
}
REQUIRED_VITALS = {"temp", "hr", "rr", "o2", "sbp", "dbp", "pain"}
PROTECTED_SOURCE_FIELDS = {
    "reference_esi",
    "vitals",
    "disposition",
    "resource_signals",
    "interventions",
    "arrival_transport",
    "sex",
    "age",
    "triage_narrative",
}
ALLOWED_USE_IN = {"dialogue", "physical_exam", "soap", "decision_review", "grading_reference"}


def fail(message: str) -> None:
    raise SystemExit(message)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def check_source(case: dict[str, Any]) -> None:
    source = case["source"]
    require(source.get("reference_esi") == case["acuity"], f"{case['id']} source reference ESI does not match top-level acuity.")
    require(source.get("vitals") == case["vitals"], f"{case['id']} source vitals do not match top-level vitals.")
    require(source.get("disposition") == case["disposition"], f"{case['id']} source disposition does not match top-level disposition.")
    require(source.get("arrival_transport") == case["demographics"]["transport"], f"{case['id']} source arrival transport mismatch.")
    require(source.get("sex") == case["demographics"]["sex"], f"{case['id']} source sex mismatch.")
    require(source.get("age") == case["demographics"]["age"], f"{case['id']} source age mismatch.")
    require(source.get("triage_narrative") == case["history"], f"{case['id']} source triage narrative mismatch.")
    require(source.get("adjudication", {}).get("final_decision") == "RETAIN", f"{case['id']} is not a retained validation case.")

    protected = set(case.get("augmentation", {}).get("protected_source_fields", []))
    missing = PROTECTED_SOURCE_FIELDS - protected
    require(not missing, f"{case['id']} augmentation is missing protected source fields: {sorted(missing)}")


def check_evidence(case: dict[str, Any]) -> None:
    documented = case.get("documented_evidence")
    missing = case.get("missing_evidence")
    require(isinstance(documented, list) and documented, f"{case['id']} must include documented evidence.")
    require(isinstance(missing, list), f"{case['id']} must include missing evidence list.")
    domains = {item.get("domain") for item in documented if isinstance(item, dict)}
    for domain in {"chief_complaint", "triage_narrative", "vitals", "reference_esi", "disposition"}:
        require(domain in domains, f"{case['id']} documented evidence missing {domain}.")


def check_augmentation(case: dict[str, Any]) -> None:
    augmentation = case.get("augmentation", {})
    status = augmentation.get("review_status")
    require(status not in {"draft", "rejected"}, f"{case['id']} contains a draft or rejected augmentation.")
    require(status in {"source_only", "reviewed"}, f"{case['id']} has invalid augmentation status {status!r}.")

    facts = augmentation.get("inferred_facts", [])
    require(isinstance(facts, list), f"{case['id']} inferred_facts must be a list.")
    for fact in facts:
        for field in ["id", "domain", "statement", "rationale", "source_anchors", "confidence", "review_status", "use_in"]:
            require(fact.get(field), f"{case['id']} inferred fact missing {field}.")
        require(fact["review_status"] == "reviewed", f"{case['id']} has a non-reviewed inferred fact.")
        use_in = set(fact.get("use_in", []))
        require(use_in <= ALLOWED_USE_IN, f"{case['id']} inferred fact has invalid use_in values: {sorted(use_in - ALLOWED_USE_IN)}")
        if "grading_reference" in use_in:
            require(status == "reviewed", f"{case['id']} grading reference fact is not in a reviewed augmentation.")
        if "physical_exam" in use_in or fact.get("domain") == "physical_exam":
            require(
                fact["review_status"] == "reviewed",
                f"{case['id']} physical exam fact must be reviewed or absent.",
            )


def main() -> None:
    cases = json.loads(CASE_BUNDLE.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        fail("Case bundle must be a non-empty list.")

    ids = set()
    for index, case in enumerate(cases, start=1):
        missing = REQUIRED_TOP_LEVEL - set(case)
        require(not missing, f"Case {index} is missing fields: {sorted(missing)}")

        require(case.get("schema_version") == "clinical_case_v1", f"{case.get('id', index)} has invalid schema version.")
        require(case["id"] not in ids, f"Duplicate case id: {case['id']}")
        ids.add(case["id"])

        require(set(case["vitals"]) == REQUIRED_VITALS, f"{case['id']} has unexpected vital fields.")
        require(1 <= int(case["acuity"]) <= 5, f"{case['id']} has invalid ESI acuity.")
        require("expert_opinions" not in case and "final_decision" not in case, f"{case['id']} exposes adjudication at top level.")

        check_source(case)
        check_evidence(case)
        check_augmentation(case)

    print(f"Validated {len(cases)} reviewed retained static cases.")


if __name__ == "__main__":
    main()
