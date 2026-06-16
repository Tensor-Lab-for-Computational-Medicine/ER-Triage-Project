from __future__ import annotations

import argparse
import json
from pathlib import Path

from pydantic import BaseModel, Field

from backend.grader.package import CasePackage


class ValidationPrepCase(BaseModel):
    case_id: str
    package_path: str | None = None
    required_clinician_fields: list[str] = Field(
        default_factory=lambda: [
            "acceptable_diagnoses",
            "expected_esi",
            "expected_disposition",
        ]
    )


class ValidationPrepPacket(BaseModel):
    threshold: float = 0.8
    release_case_id: str | None = None
    release_case_excluded: bool = True
    package_count: int
    cases: list[ValidationPrepCase]
    clinician_answer_key_template: dict
    evidence_template: dict
    instructions: list[str]
    grader_truth_excluded: bool = True


def build_validation_prep_packet(
    package_paths: list[Path],
    threshold: float = 0.8,
    release_case_id: str | None = None,
) -> ValidationPrepPacket:
    packages = [CasePackage.model_validate_json(path.read_text(encoding="utf-8")) for path in package_paths]
    if release_case_id:
        reused = [
            package.case_id
            for package in packages
            if package.case_id == release_case_id
        ]
        if reused:
            raise ValueError(
                "Validation prep packages must be held out from the release case: "
                + ", ".join(sorted(set(reused)))
            )
    cases = [
        ValidationPrepCase(case_id=package.case_id, package_path=str(path))
        for path, package in zip(package_paths, packages)
    ]
    answer_key_cases = [
        {
            "case_id": case.case_id,
            "acceptable_diagnoses": [],
            "expected_esi": None,
            "expected_disposition": None,
            "critical_actions": [],
        }
        for case in cases
    ]
    return ValidationPrepPacket(
        threshold=threshold,
        release_case_id=release_case_id,
        release_case_excluded=True,
        package_count=len(packages),
        cases=cases,
        clinician_answer_key_template={"cases": answer_key_cases},
        evidence_template={
            "passages": [
                {
                    "id": "replace-with-evidence-id",
                    "title": "replace-with-source-title",
                    "text": "Paste only reviewed guideline/literature passage text here.",
                    "url": "replace-with-source-url-or-null",
                }
            ]
        },
        instructions=[
            "Do not copy ground-truth fields from CasePackage into the clinician answer key.",
            "A clinician must independently fill acceptable diagnoses, expected ESI, and expected disposition for every held-out case.",
            "Do not include the release case itself in the validation package set.",
            "Run backend.grader.validate with the completed answer key; release_blocked must be false before applying case review.",
        ],
    )


def _main() -> int:
    parser = argparse.ArgumentParser(description="Create fail-closed clinician answer-key/evidence templates for grader validation.")
    parser.add_argument("packages", nargs="+", type=Path, help="Completed CasePackage JSON file(s).")
    parser.add_argument("--threshold", type=float, default=0.8, help="Validation agreement threshold to document in the prep packet.")
    parser.add_argument("--release-case-id", help="Optional release case id to exclude from the held-out validation packages.")
    parser.add_argument("--output", type=Path, help="Optional validation-prep packet path.")
    parser.add_argument("--answer-key-output", type=Path, help="Optional blank clinician answer-key template path.")
    parser.add_argument("--evidence-output", type=Path, help="Optional evidence template path.")
    args = parser.parse_args()

    packet = build_validation_prep_packet(
        [path.expanduser().resolve() for path in args.packages],
        threshold=args.threshold,
        release_case_id=args.release_case_id,
    )
    rendered = packet.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.answer_key_output:
        args.answer_key_output.parent.mkdir(parents=True, exist_ok=True)
        args.answer_key_output.write_text(
            json.dumps(packet.clinician_answer_key_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    if args.evidence_output:
        args.evidence_output.parent.mkdir(parents=True, exist_ok=True)
        args.evidence_output.write_text(
            json.dumps(packet.evidence_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
