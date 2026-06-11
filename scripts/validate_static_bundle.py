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
    "simulation_reveal_data",
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
    "adjudication",
}
ALLOWED_USE_IN = {"dialogue", "physical_exam", "soap", "decision_review", "grading_reference"}
ALLOWED_SIMULATION_REVEAL_DOMAINS = {
    "focused_physical_exam",
    "physical_exam",
    "relevant_negatives",
    "neurovascular_status",
    "mechanism",
    "imaging_or_exam_result",
}
PUBLIC_SCHEMA_VERSION = "public_case_v2"
FORBIDDEN_PUBLIC_KEYS = {
    "subject_id",
    "stay_id",
    "hadm_id",
    "icd_code",
    "icd_title",
    "linked_context",
    "optional_objective_data",
    "retrospective_ground_truth",
}
FORBIDDEN_SOURCE_KEYS = FORBIDDEN_PUBLIC_KEYS | {
    "raw_row_index",
    "intime",
    "outtime",
}


def fail(message: str) -> None:
    raise SystemExit(message)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def invalid_complaint(value: Any) -> bool:
    text = " ".join(str(value or "").split()).lower()
    return not text or text in {"unknown complaint", "unknown", "nan"} or "#name?" in text


def check_forbidden_public_fields(value: Any, path: str = "case") -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            require(key not in FORBIDDEN_PUBLIC_KEYS, f"Public bundle exposes restricted key at {path}.{key}.")
            check_forbidden_public_fields(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            check_forbidden_public_fields(item, f"{path}[{index}]")


def check_source(case: dict[str, Any]) -> None:
    source = case["source"]
    exposed = FORBIDDEN_SOURCE_KEYS & set(source)
    require(not exposed, f"{case['id']} source exposes restricted fields: {sorted(exposed)}")
    require(source.get("schema_version") == PUBLIC_SCHEMA_VERSION, f"{case['id']} source schema is not {PUBLIC_SCHEMA_VERSION}.")
    require(source.get("public_case_uid"), f"{case['id']} source is missing public_case_uid.")
    require(source.get("reference_esi") == case["acuity"], f"{case['id']} source reference ESI does not match top-level acuity.")
    require(not invalid_complaint(case.get("complaint")), f"{case['id']} has an invalid learner-facing complaint.")
    require(not invalid_complaint(source.get("chief_complaint")), f"{case['id']} has an invalid source chief complaint.")
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
    physical_exam_facts = [
        fact for fact in facts
        if fact.get("domain") == "physical_exam" or "physical_exam" in set(fact.get("use_in", []))
    ]
    require(status == "reviewed", f"{case['id']} must have reviewed augmentation before public demo use.")
    require(physical_exam_facts, f"{case['id']} is missing a reviewed focused physical exam target.")
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
            require(
                {"physical_exam", "soap", "decision_review"} <= use_in,
                f"{case['id']} physical exam fact must support physical_exam, soap, and decision_review.",
            )


def check_simulation_reveal_data(case: dict[str, Any]) -> None:
    reveal_items = case.get("simulation_reveal_data")
    require(isinstance(reveal_items, list), f"{case['id']} simulation_reveal_data must be a list.")
    missing_domains = {
        item.get("domain")
        for item in case.get("missing_evidence", [])
        if isinstance(item, dict) and item.get("domain")
    }
    covered_domains: set[str] = set()
    for item in reveal_items:
        require(isinstance(item, dict), f"{case['id']} simulation reveal item must be an object.")
        for field in [
            "id",
            "domain",
            "covers_domains",
            "label",
            "category",
            "availability",
            "value",
            "source",
            "source_basis",
            "display_policy",
            "review_status",
            "source_restriction",
            "limitation",
        ]:
            require(item.get(field), f"{case['id']} simulation reveal item missing {field}.")
        require(
            item["domain"] in ALLOWED_SIMULATION_REVEAL_DOMAINS,
            f"{case['id']} simulation reveal domain is invalid: {item['domain']}.",
        )
        require(
            item["review_status"] == "engineering_scaffold_needs_clinician_adjudication",
            f"{case['id']} simulation reveal scaffold must remain clinician-adjudication pending.",
        )
        require(
            item["source_restriction"] == "public_simulation_scaffold",
            f"{case['id']} simulation reveal scaffold has unexpected source restriction.",
        )
        require(
            item["display_policy"] in {"encounter_unlock", "plan_unlock", "reassessment_unlock", "debrief_only", "always_unlock"},
            f"{case['id']} simulation reveal scaffold has invalid display policy.",
        )
        covered_domains.add(item["domain"])
        covered_domains.update(item.get("covers_domains", []))

    uncovered = missing_domains - covered_domains
    require(not uncovered, f"{case['id']} missing source domains lack simulation reveal scaffold: {sorted(uncovered)}")


def main() -> None:
    cases = json.loads(CASE_BUNDLE.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        fail("Case bundle must be a non-empty list.")

    ids = set()
    for index, case in enumerate(cases, start=1):
        missing = REQUIRED_TOP_LEVEL - set(case)
        require(not missing, f"Case {index} is missing fields: {sorted(missing)}")

        require(case.get("schema_version") == PUBLIC_SCHEMA_VERSION, f"{case.get('id', index)} has invalid schema version.")
        require(case["id"] not in ids, f"Duplicate case id: {case['id']}")
        ids.add(case["id"])

        require(set(case["vitals"]) == REQUIRED_VITALS, f"{case['id']} has unexpected vital fields.")
        require(1 <= int(case["acuity"]) <= 5, f"{case['id']} has invalid ESI acuity.")
        require("expert_opinions" not in case and "final_decision" not in case, f"{case['id']} exposes adjudication at top level.")
        check_forbidden_public_fields(case)

        check_source(case)
        check_evidence(case)
        check_augmentation(case)
        check_simulation_reveal_data(case)

    print(f"Validated {len(cases)} reviewed retained static cases.")


if __name__ == "__main__":
    main()
