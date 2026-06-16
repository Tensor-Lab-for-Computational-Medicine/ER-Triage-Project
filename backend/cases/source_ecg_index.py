from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import re
import zipfile
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.cases.mimic_ext import load_enriched_cases


class EcgSourceIndex(BaseModel):
    source_root: str | None = None
    mimic_ecg_dir: str | None = None
    subject_ids: list[str] = Field(default_factory=list)
    limit_per_subject: int = 3
    source_paths: list[str] = Field(default_factory=list)
    rows_by_subject: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)
    row_count: int = 0
    complete_subject_ids: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    grader_only_truth_excluded: Literal[True] = True


def build_ecg_source_index(
    *,
    source_root: Path | None = None,
    mimic_ecg_dir: Path | None = None,
    subject_ids: set[str] | list[str],
    limit_per_subject: int = 3,
) -> EcgSourceIndex:
    cleaned_subject_ids = sorted({_clean_identifier(subject_id) for subject_id in subject_ids if _clean_identifier(subject_id)})
    limit = max(1, limit_per_subject)
    rows_by_subject: dict[str, list[dict[str, Any]]] = {subject_id: [] for subject_id in cleaned_subject_ids}
    notes: list[str] = []
    sources = _ecg_measurement_sources(source_root=source_root, mimic_ecg_dir=mimic_ecg_dir)
    if not cleaned_subject_ids:
        notes.append("No subject IDs were provided for ECG source indexing.")
    if not sources:
        notes.append("No MIMIC-IV-ECG machine_measurements source was found for indexing.")

    for source_file, source_member in sources:
        try:
            for row in _iter_ecg_measurement_rows(source_file, source_member):
                subject_id = _clean_identifier(row.get("subject_id"))
                if subject_id not in rows_by_subject:
                    continue
                if len(rows_by_subject[subject_id]) >= limit:
                    continue
                narrative = _ecg_machine_report(row)
                if not narrative and not _ecg_values_present(row):
                    continue
                indexed = dict(row)
                indexed["source_file"] = str(source_file)
                if source_member:
                    indexed["source_member"] = source_member
                indexed["machine_report"] = narrative
                rows_by_subject[subject_id].append(indexed)
                if _index_complete(rows_by_subject, limit):
                    break
        except (OSError, zipfile.BadZipFile, UnicodeDecodeError, csv.Error) as exc:
            notes.append(f"Skipped ECG source {source_file}: {type(exc).__name__}: {exc}.")
        if _index_complete(rows_by_subject, limit):
            notes.append("Stopped ECG source indexing after every requested subject reached the per-subject row limit.")
            break

    populated = {subject_id: rows for subject_id, rows in rows_by_subject.items() if rows}
    missing_subjects = [subject_id for subject_id in cleaned_subject_ids if subject_id not in populated]
    if missing_subjects:
        notes.append("No ECG machine measurement rows were indexed for subject IDs: " + ", ".join(missing_subjects) + ".")
    return EcgSourceIndex(
        source_root=str(source_root.expanduser()) if source_root else None,
        mimic_ecg_dir=str(mimic_ecg_dir.expanduser()) if mimic_ecg_dir else None,
        subject_ids=cleaned_subject_ids,
        limit_per_subject=limit,
        source_paths=sorted({str(source_file) for source_file, _member in sources}),
        rows_by_subject=populated,
        row_count=sum(len(rows) for rows in populated.values()),
        complete_subject_ids=sorted(subject_id for subject_id, rows in populated.items() if len(rows) >= limit),
        notes=notes,
    )


def load_ecg_source_index(path: Path) -> EcgSourceIndex:
    return EcgSourceIndex.model_validate_json(path.read_text(encoding="utf-8"))


def subject_ids_from_enriched_cases(cases: list[dict[str, Any]], case_ids: set[str] | None = None) -> set[str]:
    subject_ids: set[str] = set()
    for case in cases:
        case_id = _enriched_case_id(case)
        if case_ids and case_id not in case_ids:
            continue
        identifiers = case.get("identifiers") or {}
        subject_id = _clean_identifier(identifiers.get("subject_id"))
        if subject_id:
            subject_ids.add(subject_id)
    return subject_ids


def _ecg_measurement_sources(
    *,
    source_root: Path | None,
    mimic_ecg_dir: Path | None,
) -> list[tuple[Path, str | None]]:
    roots = [root.expanduser() for root in [mimic_ecg_dir, source_root] if root]
    sources: list[tuple[Path, str | None]] = []
    for root in roots:
        sources.extend(_ecg_measurement_sources_from_root(root))
    seen: set[tuple[str, str | None]] = set()
    deduped: list[tuple[Path, str | None]] = []
    for source in sources:
        key = (str(source[0]), source[1])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(source)
    return deduped


def _ecg_measurement_sources_from_root(root: Path) -> list[tuple[Path, str | None]]:
    if root.is_file():
        if root.suffix.lower() == ".zip":
            member = _ecg_measurement_zip_member(root)
            return [(root, member)] if member else []
        if root.name.lower() in {"machine_measurements.csv", "machine_measurements.csv.gz"}:
            return [(root, None)]
    if not root.is_dir():
        return []
    sources: list[tuple[Path, str | None]] = []
    for candidate in [
        root / "machine_measurements.csv.gz",
        root / "machine_measurements.csv",
        *sorted(root.glob("*/machine_measurements.csv.gz")),
        *sorted(root.glob("*/machine_measurements.csv")),
    ]:
        if candidate.is_file():
            sources.append((candidate, None))
    for zip_path in [*sorted(root.glob("*ecg*.zip")), *sorted(root.glob("*/**/*ecg*.zip"))]:
        member = _ecg_measurement_zip_member(zip_path)
        if member:
            sources.append((zip_path, member))
    return sources


def _ecg_measurement_zip_member(zip_path: Path) -> str | None:
    try:
        with zipfile.ZipFile(zip_path) as archive:
            members = [
                name
                for name in archive.namelist()
                if _zip_member_named(name, ("machine_measurements.csv", "machine_measurements.csv.gz"))
            ]
    except (OSError, zipfile.BadZipFile):
        return None
    return sorted(members, key=lambda name: name.replace("\\", "/").lower())[0] if members else None


def _zip_member_named(name: str, candidates: tuple[str, ...]) -> bool:
    normalized = name.replace("\\", "/").lower()
    return any(normalized == candidate or normalized.endswith(f"/{candidate}") for candidate in candidates)


def _iter_ecg_measurement_rows(source_file: Path, source_member: str | None):
    if source_member:
        with zipfile.ZipFile(source_file) as archive:
            with archive.open(source_member) as raw_stream:
                stream = gzip.GzipFile(fileobj=raw_stream) if source_member.lower().endswith(".gz") else raw_stream
                yield from _iter_csv_dict_rows(stream)
        return
    if source_file.suffix.lower() == ".gz":
        with gzip.open(source_file, "rb") as stream:
            yield from _iter_csv_dict_rows(stream)
        return
    with source_file.open("rb") as stream:
        yield from _iter_csv_dict_rows(stream)


def _iter_csv_dict_rows(stream):
    text_stream = io.TextIOWrapper(stream, encoding="utf-8", errors="replace", newline="")
    reader = csv.DictReader(text_stream)
    yield from reader


def _index_complete(rows_by_subject: dict[str, list[dict[str, Any]]], limit: int) -> bool:
    return bool(rows_by_subject) and all(len(rows) >= limit for rows in rows_by_subject.values())


def _ecg_machine_report(row: dict[str, Any]) -> str:
    report_columns = [
        key
        for key in sorted(row)
        if re.fullmatch(r"report_\d+", key, flags=re.I) or key.lower() in {"report", "machine_report", "report_text"}
    ]
    return " ".join(" ".join(str(row.get(key) or "").split()) for key in report_columns).strip()


def _ecg_values_present(row: dict[str, Any]) -> bool:
    return any(_clean_identifier(row.get(key)) for key in ("heart_rate", "rr_interval", "qrs_duration", "qtc"))


def _clean_identifier(value: Any) -> str:
    text = str(value or "").strip()
    if text.endswith(".0"):
        return text[:-2]
    return text


def _enriched_case_id(case: dict[str, Any]) -> str:
    return str(case.get("id") or case.get("case_id") or "")


def _main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a local hidden-safe ECG source index for selected MIMIC-IV-Ext subject IDs."
    )
    parser.add_argument("input", type=Path, nargs="?", help="Optional local restricted enriched cases JSON.")
    parser.add_argument("--case-id", action="append", default=[], help="Restrict indexing to one enriched case id. May be repeated.")
    parser.add_argument("--subject-id", action="append", default=[], help="Additional subject_id to index. May be repeated.")
    parser.add_argument("--source-root", type=Path, help="Local source root containing MIMIC-IV-ECG files or ZIPs.")
    parser.add_argument("--mimic-ecg-dir", type=Path, help="Local MIMIC-IV-ECG root, machine_measurements CSV path, or zip.")
    parser.add_argument("--limit-per-subject", type=int, default=3, help="Maximum ECG rows stored per requested subject.")
    parser.add_argument("--output", type=Path, help="Optional ECG index JSON output path.")
    args = parser.parse_args()

    subject_ids = {_clean_identifier(subject_id) for subject_id in args.subject_id if _clean_identifier(subject_id)}
    if args.input:
        cases = load_enriched_cases(args.input)
        subject_ids.update(subject_ids_from_enriched_cases(cases, set(args.case_id) if args.case_id else None))
    index = build_ecg_source_index(
        source_root=args.source_root.expanduser().resolve() if args.source_root else None,
        mimic_ecg_dir=args.mimic_ecg_dir.expanduser().resolve() if args.mimic_ecg_dir else None,
        subject_ids=subject_ids,
        limit_per_subject=args.limit_per_subject,
    )
    rendered = index.model_dump_json(indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if index.row_count else 1


if __name__ == "__main__":
    raise SystemExit(_main())
