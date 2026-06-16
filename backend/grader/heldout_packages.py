from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from backend.cases.mimic_ext import load_enriched_cases, prepare_mimic_ext_case
from backend.cases.playthrough import PlaythroughAction, run_scripted_playthrough
from backend.cases.prepare import CasePreparationError
from backend.cases.readiness import ABDOMINAL_COMPLAINT_TERMS
from backend.cases.schemas import PreparedCase
from backend.grader.validation_prep import ValidationPrepPacket, build_validation_prep_packet


class HeldoutPackageRecord(BaseModel):
    case_id: str
    package_path: str | None = None
    playthrough_report_path: str | None = None
    objective_ready: bool = False
    skipped_reason: str | None = None


class HeldoutPackageManifest(BaseModel):
    source_file: str
    output_dir: str
    release_case_id: str | None = None
    release_case_excluded: bool = True
    requested_count: int
    generated_count: int
    records: list[HeldoutPackageRecord] = Field(default_factory=list)
    package_paths: list[str] = Field(default_factory=list)
    validation_prep: ValidationPrepPacket | None = None
    instructions: list[str] = Field(default_factory=list)
    grader_truth_in_packages: bool = True


def build_heldout_validation_packages(
    enriched_cases: list[dict[str, Any]],
    *,
    output_dir: Path,
    source_file: str = "",
    release_case_id: str | None = None,
    max_cases: int = 3,
) -> HeldoutPackageManifest:
    output_dir.mkdir(parents=True, exist_ok=True)
    records: list[HeldoutPackageRecord] = []
    package_paths: list[Path] = []

    for enriched_case in enriched_cases:
        if len(package_paths) >= max_cases:
            break
        case_id = str(enriched_case.get("id") or enriched_case.get("case_id") or "")
        if release_case_id and case_id == release_case_id:
            records.append(HeldoutPackageRecord(case_id=case_id, skipped_reason="release case excluded from held-out validation set"))
            continue
        try:
            case = prepare_mimic_ext_case(enriched_case)
            report, package = run_scripted_playthrough(case, validation_playthrough_actions(case))
        except Exception as exc:
            records.append(HeldoutPackageRecord(case_id=case_id, skipped_reason=f"{type(exc).__name__}: {exc}"))
            continue
        if package is None or not report.completed or not report.package_assembled:
            records.append(HeldoutPackageRecord(case_id=case.case_id, skipped_reason="playthrough did not produce a completed CasePackage"))
            continue
        if not report.objective_ready:
            records.append(HeldoutPackageRecord(case_id=case.case_id, skipped_reason="playthrough did not meet objective readiness checklist"))
            continue

        package_path = output_dir / f"{case.case_id}.package.json"
        report_path = output_dir / f"{case.case_id}.playthrough-report.json"
        package_path.write_text(package.model_dump_json(indent=2) + "\n", encoding="utf-8")
        report_path.write_text(report.model_dump_json(indent=2) + "\n", encoding="utf-8")
        package_paths.append(package_path)
        records.append(
            HeldoutPackageRecord(
                case_id=case.case_id,
                package_path=str(package_path),
                playthrough_report_path=str(report_path),
                objective_ready=report.objective_ready,
            )
        )

    validation_prep = (
        build_validation_prep_packet(package_paths, release_case_id=release_case_id)
        if package_paths
        else None
    )
    return HeldoutPackageManifest(
        source_file=source_file,
        output_dir=str(output_dir),
        release_case_id=release_case_id,
        requested_count=max_cases,
        generated_count=len(package_paths),
        records=records,
        package_paths=[str(path) for path in package_paths],
        validation_prep=validation_prep,
        instructions=[
            "Generated CasePackage files include grader-only hidden truth and must remain local.",
            "The clinician answer key template is intentionally blank; a clinician must independently score every held-out case.",
            "Do not include the release case package in the held-out validation set.",
            "Run backend.grader.validate with the completed answer key and evidence passages; release_blocked must be false before learner feedback is enabled.",
        ],
    )


def validation_playthrough_actions(case: PreparedCase) -> list[PlaythroughAction]:
    text = f"{case.title} {case.visible_start.chief_complaint}".lower()
    abdominal = any(term in text for term in ABDOMINAL_COMPLAINT_TERMS)
    if abdominal:
        orders = ["cbc", "bmp", "lft", "lipase", "troponin", "ecg_12_lead", "ct_abdomen_pelvis_with_contrast"]
        diagnoses = ["high-risk abdominal process", "pancreatitis", "biliary disease", "cardiac mimic", "vascular emergency"]
        consult = "surgery"
        assessment = "High-risk abdominal pain requiring monitored ED workup and disposition planning."
        plan = "Continue source-backed labs/imaging review, symptom control, monitoring, and surgical consultation as indicated."
    else:
        orders = ["cbc", "bmp", "troponin", "ecg_12_lead", "chest_xray"]
        diagnoses = ["high-risk ED presentation", "cardiac process", "infectious process", "pulmonary process"]
        consult = "medicine"
        assessment = "High-risk ED presentation requiring continued monitored evaluation."
        plan = "Continue source-backed workup review, monitoring, symptom control, and disposition planning."

    actions: list[dict[str, Any]] = [
        {"type": "ask_patient", "text": "What brought you to the emergency department today?"},
        {"type": "exam", "exam_maneuver_id": "general_inspection_appearance"},
    ]
    if abdominal:
        actions.extend(
            [
                {"type": "exam", "exam_maneuver_id": "abdomen_inspection_distention"},
                {"type": "exam", "exam_maneuver_id": "abdomen_palpation_light"},
            ]
        )
    actions.extend(
        [
            {"type": "call_consult", "specialty": consult},
            {"type": "intervention", "intervention_id": "cardiac_monitor"},
            {"type": "intervention", "intervention_id": "iv_access"},
            {"type": "intervention", "intervention_id": "analgesia"},
            {"type": "commit_esi", "level": 3, "rationale": "Initial broad ED risk assessment before objective results return."},
            *[{"type": "order", "order_id": order_id} for order_id in orders],
            {"type": "advance_time", "dt_minutes": 90},
        ]
    )
    result_order_id = _source_backed_result_order_id(case, orders)
    if result_order_id:
        actions.append({"type": "result_context", "order_id": result_order_id})
    actions.extend(
        [
            {"type": "commit_esi", "level": 2, "rationale": "Revised after persistent high-risk presentation and structured workup."},
            {"type": "commit_differential", "diagnoses": diagnoses},
            {
                "type": "commit_soap",
                "soap": {
                    "assessment": assessment,
                    "plan": plan,
                },
            },
            {"type": "complete"},
        ]
    )
    return [PlaythroughAction.model_validate(action) for action in actions]


def _source_backed_result_order_id(case: PreparedCase, ordered_ids: list[str]) -> str | None:
    for order_id in ordered_ids:
        if order_id in case.result_bundles:
            return order_id
    return next(iter(case.result_bundles), None)


def _main() -> int:
    parser = argparse.ArgumentParser(description="Create local held-out CasePackage files for grader validation prep.")
    parser.add_argument("input", type=Path, help="Local restricted enriched cases JSON.")
    parser.add_argument("--output-dir", required=True, type=Path, help="Directory for held-out package/report/template artifacts.")
    parser.add_argument("--release-case-id", help="Release case id to exclude from held-out package generation.")
    parser.add_argument("--max-cases", type=int, default=3, help="Maximum held-out packages to generate.")
    parser.add_argument("--manifest-output", type=Path, help="Optional manifest JSON path.")
    args = parser.parse_args()

    if args.max_cases < 1:
        raise CasePreparationError("--max-cases must be at least 1")
    cases = load_enriched_cases(args.input)
    manifest = build_heldout_validation_packages(
        cases,
        output_dir=args.output_dir.expanduser().resolve(),
        source_file=str(args.input),
        release_case_id=args.release_case_id,
        max_cases=args.max_cases,
    )
    manifest_path = args.manifest_output or args.output_dir / "heldout-validation-packages.manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(manifest.model_dump_json(indent=2) + "\n", encoding="utf-8")
    if manifest.validation_prep:
        (args.output_dir / "clinician-answer-key.template.json").write_text(
            json.dumps(manifest.validation_prep.clinician_answer_key_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        (args.output_dir / "evidence.template.json").write_text(
            json.dumps(manifest.validation_prep.evidence_template, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    return 0 if manifest.generated_count else 1


if __name__ == "__main__":
    raise SystemExit(_main())
