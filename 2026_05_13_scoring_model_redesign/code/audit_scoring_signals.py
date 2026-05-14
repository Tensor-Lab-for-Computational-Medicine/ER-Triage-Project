"""Audit MIETIC fields used by the ER triage scoring model."""

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "data" / "raw" / "mietic_validate_samples.csv"
OUTFILE = ROOT / "2026_05_13_scoring_model_redesign" / "data" / "scoring_signal_audit.csv"


SIGNALS = [
    ("reference_esi", "acuity", "Direct reference label"),
    ("resource_count", "resources_used", "Direct resource count"),
    ("labs", "lab_event_count", "Direct resource evidence"),
    ("microbiology", "microbio_event_count", "Direct resource evidence"),
    ("imaging_exams", "exam_count", "Direct resource evidence"),
    ("procedures", "procedure_count", "Direct resource evidence"),
    ("iv_access", "intravenous", "Direct ED intervention"),
    ("iv_fluids", "intravenous_fluids", "Direct ED intervention"),
    ("im_medication", "intramuscular", "Direct ED intervention"),
    ("oral_medication", "oral_medications", "Direct ED intervention"),
    ("nebulized_medication", "nebulized_medications", "Direct ED intervention"),
    ("tier1_medication_1h", "tier1_med_usage_1h", "Direct ED intervention"),
    ("tier2_medication", "tier2_med_usage", "Direct ED intervention"),
    ("tier3_medication", "tier3_med_usage", "Direct ED intervention"),
    ("tier4_medication", "tier4_med_usage", "Direct ED intervention"),
    ("invasive_ventilation_1h", "invasive_ventilation", "Direct ED intervention"),
    ("critical_procedure", "critical_procedure", "Direct ED intervention"),
    ("psychotropic_medication_120m", "psychotropic_med_within_120min", "Direct ED intervention"),
    ("red_cell_order", "red_cell_order_more_than_1", "Direct transfusion evidence"),
    ("transfusion_1h", "transfusion_within_1h", "Direct transfusion evidence"),
    ("transfusion_after_1h", "transfusion_beyond_1h", "Direct transfusion evidence"),
    ("icu_transfer_1h", "transfer_to_icu_in_1h", "Direct outcome evidence"),
    ("icu_transfer_after_1h", "transfer_to_icu_beyond_1h", "Direct outcome evidence"),
    ("death_1h", "expired_within_1h", "Direct outcome evidence"),
    ("death_after_1h", "expired_beyond_1h", "Direct outcome evidence"),
]


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = df.columns.str.replace("\ufeff", "")
    if df.columns[0].startswith("é") or "subject" not in df.columns[0].lower():
        df.columns = ["subject_id"] + list(df.columns[1:])
    return df


def nonzero_count(series: pd.Series) -> int:
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    return int((numeric != 0).sum())


def main() -> None:
    df = normalize_columns(pd.read_csv(DATASET, encoding="utf-8-sig"))
    rows = []
    for signal, column, support_type in SIGNALS:
        if column not in df.columns:
            rows.append(
                {
                    "signal": signal,
                    "column": column,
                    "support_type": support_type,
                    "present_in_dataset": False,
                    "nonzero_cases": 0,
                    "total_cases": len(df),
                }
            )
            continue

        rows.append(
            {
                "signal": signal,
                "column": column,
                "support_type": support_type,
                "present_in_dataset": True,
                "nonzero_cases": nonzero_count(df[column]),
                "total_cases": len(df),
            }
        )

    audit = pd.DataFrame(rows)
    OUTFILE.parent.mkdir(parents=True, exist_ok=True)
    audit.to_csv(OUTFILE, index=False)
    print(f"Wrote {OUTFILE}")


if __name__ == "__main__":
    main()
