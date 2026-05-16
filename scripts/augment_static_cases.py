"""Create draft AI augmentations for retained MIETIC-derived cases.

The generated file is a review queue. It is not loaded by the learner app until
facts are reviewed and copied or promoted into case_augmentations.review.json.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from generate_static_cases import (
    CASE_AUGMENTATION_VERSION,
    PROCESSED_DIR,
    REVIEW_JSON,
    build_cases,
    compact_text,
)


ROOT = Path(__file__).resolve().parents[1]
DRAFT_JSON = PROCESSED_DIR / "case_augmentations.draft.json"
PROMPT_VERSION = "case_augmentation_prompt_v1"
DEFAULT_MODEL = "openrouter/auto"


def load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def reviewed_case_ids() -> set[str]:
    if not REVIEW_JSON.exists():
        return set()
    data = json.loads(REVIEW_JSON.read_text(encoding="utf-8"))
    return {
        case_id
        for case_id, entry in data.get("cases", {}).items()
        if entry.get("review_status") == "reviewed"
    }


def source_summary(case: dict[str, Any]) -> dict[str, Any]:
    return {
        "case_id": case["id"],
        "chief_complaint": case["complaint"],
        "triage_narrative": case["history"],
        "demographics": case["demographics"],
        "vitals": case["vitals"],
        "reference_esi": case["acuity"],
        "disposition": case["disposition"],
        "resource_signals": case["source"]["resource_signals"],
        "interventions": case["interventions"],
        "documented_evidence": case.get("documented_evidence", []),
        "missing_evidence": case.get("missing_evidence", []),
    }


def build_prompt(case: dict[str, Any]) -> str:
    source = source_summary(case)
    return "\n".join(
        [
            "Create reviewed-draft clinical teaching augmentation for one emergency department triage case.",
            "Return JSON only. Do not include Markdown.",
            "Do not change or contradict source vitals, ESI, disposition, resource counts, interventions, demographics, arrival mode, or triage narrative.",
            "Infer only clinically plausible missing details that are needed for patient dialogue, focused physical exam, SOAP assessment, DDx, and decision review.",
            "Every inferred fact must include source_anchors from the source case and a confidence value of low, moderate, or high.",
            "Use review_status draft for the case and each inferred fact.",
            "The output schema is:",
            json.dumps(
                {
                    "review_status": "draft",
                    "generated_by": "openrouter",
                    "model": "MODEL_NAME",
                    "prompt_version": PROMPT_VERSION,
                    "likely_working_diagnosis": "string",
                    "ddx": [
                        {
                            "diagnosis": "string",
                            "support": "string",
                            "against_or_missing": "string",
                            "next_discriminator": "string",
                            "acuity_implication": "string",
                        }
                    ],
                    "teaching_points": ["string"],
                    "inferred_facts": [
                        {
                            "id": f"{case['id']}_exam_01",
                            "domain": "physical_exam",
                            "statement": "string",
                            "rationale": "string",
                            "source_anchors": ["string"],
                            "confidence": "moderate",
                            "review_status": "draft",
                            "use_in": ["dialogue", "physical_exam", "soap", "decision_review"],
                            "action_id": "optional scoring action id",
                            "expected_action": "string",
                            "practice_rule": "string",
                        }
                    ],
                },
                indent=2,
            ),
            "Source case:",
            json.dumps(source, indent=2, ensure_ascii=False),
        ]
    )


def call_openrouter(prompt: str, *, model: str, api_key: str) -> dict[str, Any]:
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are an emergency physician simulation case author. Return strict JSON only.",
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    request = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost/er-triage-project",
            "X-Title": "ED Triage Trainer Case Augmentation",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenRouter request failed: {error.code} {detail}") from error
    content = body["choices"][0]["message"]["content"]
    return json.loads(content)


def validate_draft(case: dict[str, Any], draft: dict[str, Any], *, model: str) -> dict[str, Any]:
    facts = draft.get("inferred_facts")
    if not isinstance(facts, list) or not facts:
        raise ValueError("Draft must include at least one inferred fact.")

    protected_values = [
        str(case["acuity"]),
        str(case["disposition"]),
        str(case["demographics"]["age"]),
        str(case["demographics"]["sex"]),
        str(case["demographics"]["transport"]),
    ]
    normalized_facts = []
    for index, fact in enumerate(facts, start=1):
        for field in ["domain", "statement", "rationale", "source_anchors", "confidence", "use_in"]:
            if not fact.get(field):
                raise ValueError(f"Inferred fact {index} missing {field}.")
        if fact.get("review_status") != "draft":
            raise ValueError(f"Inferred fact {index} must be draft before review.")
        if "grading_reference" in fact.get("use_in", []):
            raise ValueError("Draft facts cannot be promoted to grading_reference.")
        text = f"{fact.get('statement')} {fact.get('rationale')}"
        if any(value and value in text for value in protected_values[:2]):
            raise ValueError("Draft appears to restate protected source truth as an inference.")
        normalized_facts.append(
            {
                **fact,
                "id": fact.get("id") or f"{case['id']}_inferred_{index:02d}",
                "statement": compact_text(fact["statement"]),
                "rationale": compact_text(fact["rationale"]),
                "source_anchors": [compact_text(item) for item in fact["source_anchors"] if compact_text(item)],
                "review_status": "draft",
            }
        )

    return {
        "review_status": "draft",
        "version": CASE_AUGMENTATION_VERSION,
        "generated_by": "openrouter",
        "model": draft.get("model") or model,
        "prompt_version": draft.get("prompt_version") or PROMPT_VERSION,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "likely_working_diagnosis": compact_text(draft.get("likely_working_diagnosis", "")),
        "ddx": draft.get("ddx", []),
        "teaching_points": [compact_text(item) for item in draft.get("teaching_points", []) if compact_text(item)],
        "inferred_facts": normalized_facts,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate draft AI case augmentations for review.")
    parser.add_argument("--case-id", action="append", help="Limit generation to one or more case ids.")
    parser.add_argument("--model", default=os.environ.get("OPENROUTER_AUGMENTATION_MODEL", DEFAULT_MODEL))
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of cases to generate.")
    parser.add_argument("--overwrite", action="store_true", help="Regenerate drafts that already exist.")
    args = parser.parse_args()

    load_dotenv()
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise SystemExit("OPENROUTER_API_KEY is required to generate draft augmentations.")

    existing = {"schema_version": "case_augmentation_draft_v1", "cases": {}}
    if DRAFT_JSON.exists():
        existing = json.loads(DRAFT_JSON.read_text(encoding="utf-8"))

    reviewed = reviewed_case_ids()
    selected = set(args.case_id or [])
    cases = [case for case in build_cases() if (not selected or case["id"] in selected)]
    if args.limit:
        cases = cases[: args.limit]

    generated = 0
    for case in cases:
        if case["id"] in reviewed:
            continue
        if case["id"] in existing.get("cases", {}) and not args.overwrite:
            continue
        prompt = build_prompt(case)
        draft = call_openrouter(prompt, model=args.model, api_key=api_key)
        existing.setdefault("cases", {})[case["id"]] = validate_draft(case, draft, model=args.model)
        generated += 1

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    DRAFT_JSON.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {generated} draft augmentations to {DRAFT_JSON}")


if __name__ == "__main__":
    main()
