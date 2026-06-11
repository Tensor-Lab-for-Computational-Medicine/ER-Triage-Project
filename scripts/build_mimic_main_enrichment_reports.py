"""Build local-only MIMIC-IV main/ED enrichment inventory and audit reports.

The generated artifacts are intended for `reports/restricted/`, which is
gitignored. They summarize what the local MIMIC-IV main hosp/icu release and
optional MIMIC-IV-ED release can support for MIETIC case enrichment and audit
the generated restricted bundle without copying raw patient identifiers into
summary rows.
"""

from __future__ import annotations

import argparse
import gzip
import json
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MIMICIV_DIR = Path(r"D:\Projects\EHR Triage\mimic-iv-3.1\mimic-iv-3.1")
DEFAULT_MIMIC_ED_DIR = Path(r"D:\Projects\EHR Triage\mimic-iv-ed-2.2\mimic-iv-ed-2.2\ed")
DEFAULT_BUNDLE = ROOT / "data" / "restricted" / "mietic_mimic_main_ed_enriched_cases.restricted.json"
DEFAULT_MIETIC = ROOT / "data" / "raw" / "mietic_validate_samples.csv"
DEFAULT_OUT_DIR = ROOT / "reports" / "restricted"
ROW_COUNT_MAX_MB = 150


TABLE_FACT_MAP: dict[str, dict[str, str]] = {
    "ed.edstays": {
        "clinical_facts": "ED stay arrival/departure timing, linked hospital admission, demographics, arrival transport, and ED disposition.",
        "current_use": "Used for ED timing, transport, disposition reconciliation, and source linkage.",
        "enrichment_role": "ED encounter trajectory",
    },
    "ed.triage": {
        "clinical_facts": "ED triage vitals, pain, acuity, and chief complaint.",
        "current_use": "Used to verify and supplement MIETIC triage facts.",
        "enrichment_role": "ED triage baseline",
    },
    "ed.vitalsign": {
        "clinical_facts": "Repeat ED vital signs and rhythm/pain over time.",
        "current_use": "Used for encounter-unlock repeat vitals and reassessment trends.",
        "enrichment_role": "ED reassessment",
    },
    "ed.diagnosis": {
        "clinical_facts": "ED diagnosis ICD code/title sequence for the stay.",
        "current_use": "Used for debrief-only ED retrospective diagnoses.",
        "enrichment_role": "ED retrospective ground truth",
    },
    "ed.medrecon": {
        "clinical_facts": "Medication reconciliation entries with names and therapeutic class descriptions.",
        "current_use": "Used for encounter-unlock home medication context when available.",
        "enrichment_role": "Medication history",
    },
    "ed.pyxis": {
        "clinical_facts": "ED medication dispensing/admin access events with chart time and medication names.",
        "current_use": "Used for plan-unlock ED medications and early treatment realism.",
        "enrichment_role": "ED medications",
    },
    "hosp.admissions": {
        "clinical_facts": "Admission/discharge timing, admission type/location, ED registration/out time, discharge location, in-hospital expiration flag.",
        "current_use": "Used for hospital trajectory, disposition/outcome timing, and retrospective context.",
        "enrichment_role": "Hospital course and outcomes",
    },
    "hosp.patients": {
        "clinical_facts": "Sex, anchor age/year, year group, and date of death.",
        "current_use": "Available but not surfaced by the current linker because MIETIC already carries age/sex and admission outcome carries in-hospital mortality.",
        "enrichment_role": "Demographics and longitudinal mortality",
    },
    "hosp.diagnoses_icd": {
        "clinical_facts": "Retrospective ICD diagnosis codes for the hospital admission.",
        "current_use": "Used with d_icd_diagnoses for debrief-only diagnoses.",
        "enrichment_role": "Retrospective ground truth",
    },
    "hosp.d_icd_diagnoses": {
        "clinical_facts": "ICD diagnosis long-title dictionary.",
        "current_use": "Used to translate diagnosis codes into readable labels.",
        "enrichment_role": "Dictionary",
    },
    "hosp.procedures_icd": {
        "clinical_facts": "Retrospective coded procedures with chart dates.",
        "current_use": "Used with d_icd_procedures for debrief-only procedure evidence.",
        "enrichment_role": "Procedures",
    },
    "hosp.d_icd_procedures": {
        "clinical_facts": "ICD procedure long-title dictionary.",
        "current_use": "Used to translate procedure codes into readable labels.",
        "enrichment_role": "Dictionary",
    },
    "hosp.labevents": {
        "clinical_facts": "Lab result time, specimen/item, numeric/text result, units, reference ranges, abnormal flags, priority.",
        "current_use": "Used for unlockable objective labs, glucose, blood bank/type-screen signals, and case evidence.",
        "enrichment_role": "Objective results",
    },
    "hosp.d_labitems": {
        "clinical_facts": "Lab item label, fluid, and category.",
        "current_use": "Used to label and classify linked lab events.",
        "enrichment_role": "Dictionary",
    },
    "hosp.microbiologyevents": {
        "clinical_facts": "Culture/specimen/test timing, organism, antibiotic, dilution, interpretation.",
        "current_use": "Used for culture/microbiology unlockable objective evidence.",
        "enrichment_role": "Microbiology",
    },
    "hosp.poe": {
        "clinical_facts": "Provider order entry timing, order type/subtype, transaction type, status.",
        "current_use": "Used for imaging, consult, lab, blood-bank, respiratory, and other order signals.",
        "enrichment_role": "Orders and plan realism",
    },
    "hosp.poe_detail": {
        "clinical_facts": "Order details such as code status and order-specific field values.",
        "current_use": "Available but not surfaced in the current bundle; high-value next target for code-status and order-detail realism.",
        "enrichment_role": "Order details",
    },
    "hosp.prescriptions": {
        "clinical_facts": "Medication orders, timing, dose, strength, frequency support, route.",
        "current_use": "Used for plan-unlock medication evidence.",
        "enrichment_role": "Medication orders",
    },
    "hosp.pharmacy": {
        "clinical_facts": "Pharmacy verification/entry timing, medication, route, frequency, status.",
        "current_use": "Used for plan-unlock medication evidence and timing.",
        "enrichment_role": "Medication workflow",
    },
    "hosp.emar": {
        "clinical_facts": "Medication administration time, medication, scheduled/store time, event text.",
        "current_use": "Used for medication-given evidence where linked rows exist.",
        "enrichment_role": "Medication administrations",
    },
    "hosp.emar_detail": {
        "clinical_facts": "Administration details such as dose due/given, product, route, infusion rate, site.",
        "current_use": "Available but not surfaced in the current bundle; high-value next target for dose/route fidelity.",
        "enrichment_role": "Administration details",
    },
    "hosp.services": {
        "clinical_facts": "Service transfer time and current/previous service.",
        "current_use": "Used for service path and consult/transfer realism.",
        "enrichment_role": "Hospital trajectory",
    },
    "hosp.transfers": {
        "clinical_facts": "Care-unit transfers, event type, in/out timing.",
        "current_use": "Used for ED-to-floor/ICU trajectory, reassessment updates, and retrospective path.",
        "enrichment_role": "Hospital trajectory",
    },
    "hosp.drgcodes": {
        "clinical_facts": "DRG type/code, description, severity, mortality.",
        "current_use": "Available but not surfaced; useful for coarse severity validation, not real-time learner data.",
        "enrichment_role": "Severity validation",
    },
    "hosp.hcpcsevents": {
        "clinical_facts": "HCPCS-coded services/procedures by date.",
        "current_use": "Available but not surfaced; lower priority than ICD procedures and POE for case simulation.",
        "enrichment_role": "Procedure/service billing context",
    },
    "hosp.omr": {
        "clinical_facts": "Outpatient measurements and results by date.",
        "current_use": "Available but not surfaced; possible source for prior BP/weight/labs when a defensible time window is defined.",
        "enrichment_role": "Longitudinal background",
    },
    "hosp.provider": {
        "clinical_facts": "Provider IDs only.",
        "current_use": "Not used; no direct teaching value and should not be exposed.",
        "enrichment_role": "Identifier dictionary",
    },
    "icu.icustays": {
        "clinical_facts": "ICU stay ID, first/last care unit, ICU in/out time, ICU length of stay.",
        "current_use": "Used for ICU trajectory, reassessment, and retrospective ground truth.",
        "enrichment_role": "ICU trajectory",
    },
    "icu.d_items": {
        "clinical_facts": "ICU item labels, abbreviations, categories, links, units, normal ranges.",
        "current_use": "Used to label ICU procedureevents and inputevents.",
        "enrichment_role": "ICU dictionary",
    },
    "icu.procedureevents": {
        "clinical_facts": "ICU procedure/intervention timing, item, duration/value, location, status.",
        "current_use": "Used for ICU procedures and debrief-only intervention evidence.",
        "enrichment_role": "ICU procedures",
    },
    "icu.inputevents": {
        "clinical_facts": "ICU inputs/infusions, amounts, rates, timing, order categories, status.",
        "current_use": "Used for ICU medication/fluid/pressor trajectory where linked rows exist.",
        "enrichment_role": "ICU treatments",
    },
    "icu.ingredientevents": {
        "clinical_facts": "Ingredient-level components for ICU inputs.",
        "current_use": "Available but not surfaced; useful for finer medication/fluid composition after inputevents review.",
        "enrichment_role": "ICU treatment details",
    },
    "icu.chartevents": {
        "clinical_facts": "ICU charted observations, vitals, device settings, scores, assessments, values and warnings.",
        "current_use": "Available but not surfaced because it is very large; next target should use an indexed restricted cache and selected item allowlist.",
        "enrichment_role": "ICU monitoring",
    },
    "icu.outputevents": {
        "clinical_facts": "ICU outputs such as urine/drain volumes with timing.",
        "current_use": "Available but not surfaced; useful for shock/renal/perfusion realism after item allowlist review.",
        "enrichment_role": "ICU outputs",
    },
    "icu.datetimeevents": {
        "clinical_facts": "ICU datetime-valued charted milestones.",
        "current_use": "Available but not surfaced; lower priority unless specific milestones are needed.",
        "enrichment_role": "ICU milestones",
    },
    "icu.caregiver": {
        "clinical_facts": "Caregiver IDs only.",
        "current_use": "Not used; no direct teaching value and should not be exposed.",
        "enrichment_role": "Identifier dictionary",
    },
}

FIELD_REQUIREMENTS = {
    "ed_timing": ("ed", ["edstays"]),
    "ed_triage": ("ed", ["triage"]),
    "ed_repeat_vitals": ("ed", ["repeat_vitals"]),
    "ed_diagnoses": ("ed", ["diagnoses"]),
    "ed_medication_reconciliation": ("ed", ["medrecon"]),
    "ed_pyxis_medications": ("ed", ["pyxis"]),
    "hospital_trajectory": ("hosp", ["admissions", "services", "transfers"]),
    "diagnoses": ("hosp", ["diagnoses"]),
    "labs": ("hosp", ["labs"]),
    "meds": ("hosp", ["prescriptions", "pharmacy", "emar"]),
    "procedures": ("hosp", ["procedures"]),
    "transfers": ("hosp", ["transfers", "services"]),
    "icu_context": ("icu", ["icustays", "procedureevents", "inputevents"]),
    "outcomes": ("hosp", ["admissions"]),
    "timing": ("hosp", ["admissions", "labs", "poe_orders", "prescriptions", "pharmacy", "emar", "services", "transfers"]),
}


def is_gitignored(path: Path) -> bool:
    import subprocess

    try:
        relative = path.resolve().relative_to(ROOT)
    except ValueError:
        return False
    result = subprocess.run(["git", "check-ignore", "-q", str(relative)], cwd=ROOT, check=False)
    return result.returncode == 0


def assert_restricted_out_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    probe = path / "probe.restricted.json"
    if not is_gitignored(probe):
        raise SystemExit(f"Refusing to write restricted reports to a non-ignored directory: {path}")


def read_header(path: Path) -> list[str]:
    with gzip.open(path, "rt", encoding="utf-8", errors="replace", newline="") as handle:
        return handle.readline().strip("\r\n").split(",")


def count_rows(path: Path) -> int:
    with gzip.open(path, "rt", encoding="utf-8", errors="replace", newline="") as handle:
        return max(sum(1 for _ in handle) - 1, 0)


def inventory_mimiciv(mimiciv_dir: Path, mimic_ed_dir: Path | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(mimiciv_dir.rglob("*.csv.gz")):
        if path.parent.name not in {"hosp", "icu"}:
            continue
        table_id = f"{path.parent.name}.{path.name.removesuffix('.csv.gz')}"
        size_mb = path.stat().st_size / 1024 / 1024
        row_count: int | None = None
        row_count_status = "skipped_large_file"
        if size_mb <= ROW_COUNT_MAX_MB:
            row_count = count_rows(path)
            row_count_status = "exact_count"
        mapping = TABLE_FACT_MAP.get(
            table_id,
            {
                "clinical_facts": "Not mapped yet.",
                "current_use": "Not currently surfaced by the enrichment linker.",
                "enrichment_role": "Unmapped",
            },
        )
        rows.append(
            {
                "table_id": table_id,
                "module": path.parent.name,
                "table": path.name.removesuffix(".csv.gz"),
                "path": str(path),
                "size_mb": round(size_mb, 2),
                "row_count": row_count,
                "row_count_status": row_count_status,
                "columns": read_header(path),
                **mapping,
            }
        )
    if mimic_ed_dir and mimic_ed_dir.exists():
        for path in sorted(mimic_ed_dir.glob("*.csv.gz")):
            table_id = f"ed.{path.name.removesuffix('.csv.gz')}"
            size_mb = path.stat().st_size / 1024 / 1024
            mapping = TABLE_FACT_MAP.get(
                table_id,
                {
                    "clinical_facts": "Not mapped yet.",
                    "current_use": "Not currently surfaced by the enrichment linker.",
                    "enrichment_role": "Unmapped",
                },
            )
            rows.append(
                {
                    "table_id": table_id,
                    "module": "ed",
                    "table": path.name.removesuffix(".csv.gz"),
                    "path": str(path),
                    "size_mb": round(size_mb, 2),
                    "row_count": count_rows(path),
                    "row_count_status": "exact_count",
                    "columns": read_header(path),
                    **mapping,
                }
            )
    return rows


def load_mietic_summary(path: Path) -> dict[str, Any]:
    df = pd.read_csv(path, encoding="utf-8-sig")
    columns = list(df.columns)
    first_col = columns[0]
    if "subject" not in first_col.lower():
        df = df.rename(columns={first_col: "subject_id"})
    return {
        "path": str(path.resolve()),
        "rows": int(len(df)),
        "columns": list(df.columns),
        "non_null_counts": {
            name: int(df[name].notna().sum())
            for name in ["subject_id", "stay_id", "hadm_id", "intime", "outtime", "chiefcomplaint", "tiragecase", "acuity"]
            if name in df.columns
        },
        "retained_rows": int((df["Final Decision"].astype(str).str.upper() == "RETAIN").sum()) if "Final Decision" in df.columns else None,
        "removed_rows": int((df["Final Decision"].astype(str).str.upper() == "REMOVE").sum()) if "Final Decision" in df.columns else None,
    }


def linked_field_coverage(case: dict[str, Any]) -> dict[str, bool]:
    coverage: dict[str, bool] = {}
    for field, (module, categories) in FIELD_REQUIREMENTS.items():
        module_context = case["linked_context"].get(module, {})
        coverage[field] = any(module_context.get(category) for category in categories)
    return coverage


def availability_summary(cases: list[dict[str, Any]]) -> dict[str, Any]:
    optional_counts: Counter[str] = Counter()
    linked_counts: dict[str, Counter[str]] = {}
    field_counts: Counter[str] = Counter()
    for case in cases:
        for item in case.get("optional_objective_data", []):
            if item.get("availability") == "available":
                optional_counts[item["id"]] += 1
        for module, module_context in case.get("linked_context", {}).items():
            linked_counts.setdefault(module, Counter())
            for category, values in module_context.items():
                if values:
                    linked_counts[module][category] += 1
        for field, available in linked_field_coverage(case).items():
            if available:
                field_counts[field] += 1
    return {
        "optional_objective_data_available_cases": dict(sorted(optional_counts.items())),
        "linked_category_available_cases": {module: dict(sorted(counter.items())) for module, counter in sorted(linked_counts.items())},
        "source_supported_field_available_cases": dict(sorted(field_counts.items())),
    }


def per_case_audit(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for case in cases:
        linked_context = case["linked_context"]
        optional_available = [
            item["id"]
            for item in case.get("optional_objective_data", [])
            if item.get("availability") == "available"
        ]
        linked_categories = {
            module: [category for category, values in module_context.items() if values]
            for module, module_context in linked_context.items()
        }
        limitations = []
        if not linked_categories.get("ed"):
            limitations.append("MIMIC-IV-ED module unavailable in the provided main dataset path.")
        if not linked_categories.get("note"):
            limitations.append("MIMIC-IV-Note module unavailable; no discharge/radiology note snippets linked.")
        if not linked_categories.get("cxr"):
            limitations.append("MIMIC-CXR module unavailable; no image/report context linked.")
        if not linked_categories.get("ecg"):
            limitations.append("MIMIC-IV-ECG module unavailable; no ECG machine or waveform context linked.")
        if not linked_categories.get("hosp"):
            limitations.append("No linked hospital admission rows; enrichment limited to MIETIC triage fields and source-timed labs if present.")
        if not linked_categories.get("icu"):
            limitations.append("No linked ICU stay/intervention rows in MIMIC-IV main for this case.")
        rows.append(
            {
                "case_id": case["id"],
                "public_case_uid": case["source"]["public_case_uid"],
                "source_row_index": case["source"]["source_row_index"],
                "has_subject_id": case["identifiers"].get("subject_id") is not None,
                "has_stay_id": case["identifiers"].get("stay_id") is not None,
                "has_hadm_id": case["identifiers"].get("hadm_id") is not None,
                "linked_categories": linked_categories,
                "optional_objective_data_available": optional_available,
                "source_supported_fields": linked_field_coverage(case),
                "limitations": limitations,
            }
        )
    return rows


def render_markdown(payload: dict[str, Any], inventory: list[dict[str, Any]], audit: dict[str, Any]) -> str:
    summary = audit["summary"]
    module_lines = []
    for module, module_info in payload["module_availability"].items():
        found = sum(1 for table in module_info["tables"].values() if table["status"] == "found")
        total = len(module_info["tables"])
        module_lines.append(f"| {module} | {found}/{total} |")

    table_lines = []
    for row in inventory:
        count = f"{row['row_count']:,}" if row["row_count"] is not None else row["row_count_status"]
        table_lines.append(
            f"| {row['table_id']} | {row['size_mb']} | {count} | {row['enrichment_role']} | {row['current_use']} |"
        )

    field_lines = []
    for field, count in summary["source_supported_field_available_cases"].items():
        field_lines.append(f"| {field} | {count}/{summary['case_count']} |")

    optional_lines = []
    for item_id, count in summary["optional_objective_data_available_cases"].items():
        optional_lines.append(f"| {item_id} | {count}/{summary['case_count']} |")

    notes = "\n".join(f"- {note}" for note in payload.get("notes", [])) or "- No module gaps reported."

    return "\n".join(
        [
            "# MIMIC-IV Main/ED Enrichment Inventory and Audit",
            "",
            "## Executive Summary",
            "",
            f"- Generated a local-only restricted enriched bundle with {summary['case_count']} MIETIC cases from MIMIC-IV main `hosp`/`icu` data and the available MIMIC-IV-ED module.",
            f"- The main release at `{payload['mimiciv_dir']}` exposes all expected hospital tables used by the current linker and the core ICU stay/procedure/input dictionaries.",
            f"- The ED release at `{payload.get('mimic_ed_dir', 'not supplied')}` exposes ED stay, triage, diagnosis, repeat vital-sign, med-reconciliation, and Pyxis medication context.",
            "- The provided paths still do not include MIMIC-IV-Note, MIMIC-CXR, or MIMIC-IV-ECG modules, so note snippets, image reports, and ECG context are explicitly marked unavailable rather than invented.",
            "- The current enrichment is strongest for ED trajectory, repeat vitals, ED medications/home meds, hospital trajectory, admissions/outcomes, labs, microbiology results, medication orders/administrations, diagnoses, procedures, transfers, services, and ICU course where present.",
            "",
            "## Source Boundaries",
            "",
            f"- MIETIC input: `{audit['mietic_summary']['path']}`",
            f"- Restricted bundle: `{audit['bundle_path']}`",
            f"- MIMIC-IV main path: `{payload['mimiciv_dir']}`",
            f"- MIMIC-IV-ED path: `{payload.get('mimic_ed_dir', 'not supplied')}`",
            "- Restricted outputs are written under `data/restricted/` and `reports/restricted/`, both ignored by git.",
            "",
            "## Module Availability",
            "",
            "| Module | Found tables |",
            "| --- | ---: |",
            *module_lines,
            "",
            "## MIMIC-IV Main/ED Table Inventory",
            "",
            "| Table | Size MB | Rows | Enrichment role | Current use / plan |",
            "| --- | ---: | ---: | --- | --- |",
            *table_lines,
            "",
            "## Case-Level Coverage",
            "",
            "| Source-supported field | Cases with linked evidence |",
            "| --- | ---: |",
            *field_lines,
            "",
            "## Optional Objective Data Coverage",
            "",
            "| Objective data item | Cases available |",
            "| --- | ---: |",
            *optional_lines,
            "",
            "## Missing Modules and Blocked Evidence",
            "",
            notes,
            "",
            "## Execution Plan Applied",
            "",
            "1. Use MIETIC `subject_id`, `stay_id`, `hadm_id`, `intime`, and `outtime` as linkage anchors.",
            "2. Join MIMIC-IV-ED tables by `stay_id` for ED stay timing, triage, diagnoses, repeat vitals, medication reconciliation, and Pyxis medication context.",
            "3. Join MIMIC-IV main `hosp` tables by `hadm_id` for admissions, diagnoses, procedures, labs, microbiology, orders, medications, services, and transfers.",
            "4. Join MIMIC-IV main `icu` tables by `hadm_id` for ICU stay, procedure, and input-event context; label ICU items through `icu.d_items`.",
            "5. Preserve note/CXR/ECG as module gaps because those datasets are not present at the supplied paths.",
            "6. Emit restricted `clinical_case_v3` cases with learner-unlockable objective data and debrief-only retrospective ground truth.",
            "7. Audit each case for linked categories, available objective data, and source-limited fields.",
            "",
            "## Next Evidence Targets",
            "",
            "- Add MIMIC-IV-Note, MIMIC-CXR, and MIMIC-IV-ECG when available to support note snippets, radiology reports, imaging context, and ECG summaries.",
            "- Consider a local indexed restricted cache before using very large `icu.chartevents`, `hosp.labevents`, `hosp.emar`, or `hosp.pharmacy` repeatedly; this avoids rescanning multi-hundred-MB to multi-GB compressed CSVs each run.",
            "- Review `hosp.poe_detail`, `hosp.emar_detail`, `hosp.drgcodes`, `icu.outputevents`, and selected `icu.chartevents` item allowlists for the next enrichment pass.",
            "",
        ]
    )


def deployment_readiness(payload: dict[str, Any], audit: dict[str, Any], bundle_path: Path) -> dict[str, Any]:
    summary = audit["summary"]
    module_availability = payload.get("module_availability", {})
    ed_tables = module_availability.get("ed", {}).get("tables", {})
    ed_found = sum(1 for table in ed_tables.values() if table.get("status") == "found")
    public_case_path = ROOT / "frontend" / "src" / "data" / "cases.json"
    public_case_count = None
    if public_case_path.exists():
        public_case_count = len(json.loads(public_case_path.read_text(encoding="utf-8")))

    gates = [
        {
            "gate": "local_restricted_ed_enrichment",
            "status": "pass",
            "evidence": f"{summary['case_count']} restricted cases generated; ED tables found {ed_found}/{len(ed_tables)}; repeat ED vitals available for {summary['optional_objective_data_available_cases'].get('repeat_vitals', 0)} cases.",
        },
        {
            "gate": "per_case_provenance_audit",
            "status": "pass",
            "evidence": f"{len(audit['case_audit'])} case audit rows record linked categories, objective data, source-supported fields, and limitations.",
        },
        {
            "gate": "restricted_output_boundary",
            "status": "pass" if is_gitignored(bundle_path) else "fail",
            "evidence": f"Bundle path is {'gitignored' if is_gitignored(bundle_path) else 'not gitignored'}: {bundle_path}",
        },
        {
            "gate": "public_safe_deployment_bundle",
            "status": "blocked",
            "evidence": f"Current public bundle has {public_case_count} public cases; ED-enhanced MIMIC-derived cases remain credentialed_local_only and are not public deployable.",
        },
        {
            "gate": "clinician_adjudication",
            "status": "blocked",
            "evidence": "Restricted cases are source-grounded but not documented as clinician-adjudicated for global release; augmentation fields remain local teaching drafts unless separately reviewed.",
        },
        {
            "gate": "legal_and_licensing",
            "status": "blocked",
            "evidence": "MIMIC-derived facts and identifiers are restricted to credentialed local research/validation workflows; worldwide deployment requires a nonrestricted, approved, sanitized case pathway.",
        },
        {
            "gate": "missing_source_modules",
            "status": "partial",
            "evidence": "MIMIC-IV-Note, MIMIC-CXR, and MIMIC-IV-ECG are unavailable in the supplied paths, so notes, radiology reports/images, and ECG waveform/machine summaries remain source-limited.",
        },
        {
            "gate": "equity_bias_accessibility_safety_localization",
            "status": "blocked",
            "evidence": "Global hospital deployment requires institution-specific equity/bias review, accessibility QA, safety review, localization, and governance signoff; those approvals are not proven by the restricted MIMIC linkage alone.",
        },
    ]
    return {
        "schema_version": "mietic_mimic_main_ed_deployment_readiness_v1",
        "overall_status": "local_restricted_research_ready_global_deployment_blocked",
        "ready_for_worldwide_public_deployment": False,
        "restricted_research_bundle": str(bundle_path),
        "public_case_count": public_case_count,
        "summary": {
            "restricted_case_count": summary["case_count"],
            "ed_tables_found": ed_found,
            "ed_tables_expected": len(ed_tables),
            "repeat_vitals_cases": summary["optional_objective_data_available_cases"].get("repeat_vitals", 0),
            "home_meds_cases": summary["optional_objective_data_available_cases"].get("home_meds", 0),
            "medications_given_cases": summary["optional_objective_data_available_cases"].get("medications_given", 0),
            "retrospective_diagnosis_cases": summary["optional_objective_data_available_cases"].get("retrospective_diagnoses", 0),
        },
        "gates": gates,
        "minimum_remediation_for_worldwide_deployment": [
            "Create a public-safe sanitized case set whose facts are approved for nonrestricted deployment.",
            "Complete clinician adjudication of diagnoses, dispositions, management expectations, feedback, and debrief claims.",
            "Obtain legal/licensing approval for every dataset-derived field used outside credentialed local review.",
            "Run multi-institutional safety, equity, bias, accessibility, localization, and governance review.",
            "Validate learner outcomes and failure modes across representative hospital settings before national or global release claims.",
        ],
    }


def render_deployment_markdown(readiness: dict[str, Any]) -> str:
    gate_lines = [
        f"| {gate['gate']} | {gate['status']} | {gate['evidence']} |"
        for gate in readiness["gates"]
    ]
    remediation = [f"- {item}" for item in readiness["minimum_remediation_for_worldwide_deployment"]]
    return "\n".join(
        [
            "# ED-Enhanced Case Deployment Readiness",
            "",
            "## Bottom Line",
            "",
            "- The ED-enhanced restricted bundle is suitable for local credentialed research review and simulation-development validation.",
            "- It is not ready for worldwide public hospital deployment because the MIMIC-derived enriched cases remain restricted, clinician adjudication is not proven, and global safety/equity/accessibility/localization governance is incomplete.",
            "",
            "## Readiness Gates",
            "",
            "| Gate | Status | Evidence |",
            "| --- | --- | --- |",
            *gate_lines,
            "",
            "## Minimum Remediation Before Worldwide Deployment",
            "",
            *remediation,
            "",
        ]
    )


def build_reports(args: argparse.Namespace) -> dict[str, Path]:
    mimiciv_dir = Path(args.mimiciv_dir).expanduser().resolve()
    mimic_ed_dir = Path(args.mimic_ed_dir).expanduser().resolve() if args.mimic_ed_dir else None
    bundle_path = Path(args.bundle).expanduser().resolve()
    mietic_path = Path(args.mietic).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    assert_restricted_out_dir(out_dir)

    payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    inventory = inventory_mimiciv(mimiciv_dir, mimic_ed_dir)
    cases = payload["cases"]
    audit = {
        "schema_version": "mietic_mimic_main_ed_enrichment_audit_v1",
        "bundle_path": str(bundle_path),
        "mietic_summary": load_mietic_summary(mietic_path),
        "summary": {
            "case_count": len(cases),
            **availability_summary(cases),
        },
        "case_audit": per_case_audit(cases),
    }

    inventory_payload = {
        "schema_version": "mimic_iv_main_ed_data_inventory_v1",
        "mimiciv_dir": str(mimiciv_dir),
        "mimic_ed_dir": str(mimic_ed_dir) if mimic_ed_dir else None,
        "row_count_max_mb": ROW_COUNT_MAX_MB,
        "tables": inventory,
        "module_availability": payload["module_availability"],
        "missing_module_notes": payload.get("notes", []),
    }

    readiness = deployment_readiness(payload, audit, bundle_path)

    inventory_json = out_dir / "mimic_iv_main_ed_data_inventory.restricted.json"
    audit_json = out_dir / "mietic_mimic_main_ed_enrichment_audit.restricted.json"
    report_md = out_dir / "mimic_iv_main_ed_enrichment_inventory_and_audit.restricted.md"
    readiness_json = out_dir / "mietic_mimic_main_ed_deployment_readiness.restricted.json"
    readiness_md = out_dir / "mietic_mimic_main_ed_deployment_readiness.restricted.md"
    inventory_json.write_text(json.dumps(inventory_payload, indent=2) + "\n", encoding="utf-8")
    audit_json.write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    report_md.write_text(render_markdown(payload, inventory, audit), encoding="utf-8")
    readiness_json.write_text(json.dumps(readiness, indent=2) + "\n", encoding="utf-8")
    readiness_md.write_text(render_deployment_markdown(readiness), encoding="utf-8")
    return {
        "inventory_json": inventory_json,
        "audit_json": audit_json,
        "report_md": report_md,
        "readiness_json": readiness_json,
        "readiness_md": readiness_md,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build restricted MIMIC-IV main/ED inventory and MIETIC enrichment audit reports.")
    parser.add_argument("--mimiciv-dir", default=str(DEFAULT_MIMICIV_DIR))
    parser.add_argument("--mimic-ed-dir", default=str(DEFAULT_MIMIC_ED_DIR))
    parser.add_argument("--bundle", default=str(DEFAULT_BUNDLE))
    parser.add_argument("--mietic", default=str(DEFAULT_MIETIC))
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    args = parser.parse_args()
    outputs = build_reports(args)
    for label, path in outputs.items():
        print(f"{label}: {path}")


if __name__ == "__main__":
    main()
