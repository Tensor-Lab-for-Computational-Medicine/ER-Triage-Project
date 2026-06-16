from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Iterator

from backend.cases.prepare import CasePreparationError, assert_pilot_eligible
from backend.cases.sample_cases import sample_prepared_case
from backend.cases.schemas import PreparedCase


LOGGER = logging.getLogger(__name__)
CASE_BUNDLE_MANIFEST_FILENAMES = ("case_bundle.json", "bundle_manifest.json")
PREPARED_CASE_FILENAMES = ("prepared_case.json", "case.json")


def load_prepared_case(path: Path) -> PreparedCase:
    case_path = resolve_prepared_case_path(path)
    case = PreparedCase.model_validate_json(case_path.read_text(encoding="utf-8-sig"))
    assert_pilot_eligible(case)
    return case


def resolve_prepared_case_path(path: Path) -> Path:
    """Resolve either a PreparedCase JSON file or a portable case bundle directory."""
    if path.is_file():
        return path

    manifest_path = next((path / name for name in CASE_BUNDLE_MANIFEST_FILENAMES if (path / name).is_file()), None)
    if manifest_path:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        prepared_case = manifest.get("prepared_case") or manifest.get("prepared_case_path")
        if isinstance(prepared_case, str) and prepared_case.strip():
            candidate = path / prepared_case
            if candidate.is_file():
                return candidate
            raise FileNotFoundError(f"Case bundle manifest points to missing prepared case: {candidate}")

    for filename in PREPARED_CASE_FILENAMES:
        candidate = path / filename
        if candidate.is_file():
            return candidate

    raise FileNotFoundError(f"No PreparedCase JSON found at {path}")


def iter_prepared_case_paths(data_dir: Path) -> Iterator[Path]:
    if data_dir.is_file():
        yield data_dir
        return

    if not data_dir.exists():
        return

    try:
        yield resolve_prepared_case_path(data_dir)
        return
    except FileNotFoundError:
        pass

    for path in sorted(data_dir.glob("*.json")):
        if path.name in CASE_BUNDLE_MANIFEST_FILENAMES:
            continue
        yield path

    for child in sorted(path for path in data_dir.iterdir() if path.is_dir()):
        try:
            yield resolve_prepared_case_path(child)
        except FileNotFoundError:
            continue


def load_local_cases(data_dir: Path | None = None) -> dict[str, PreparedCase]:
    data_dir = data_dir or Path("data/cases")
    cases: dict[str, PreparedCase] = {}
    if data_dir.exists():
        for path in iter_prepared_case_paths(data_dir):
            case = PreparedCase.model_validate_json(path.read_text(encoding="utf-8-sig"))
            try:
                assert_pilot_eligible(case)
            except CasePreparationError as exc:
                LOGGER.warning("Skipping pilot-ineligible case %s: %s", path, exc)
                continue
            if case.case_id in cases:
                LOGGER.warning("Skipping duplicate case_id %s from %s", case.case_id, path)
                continue
            cases[case.case_id] = case
    if not cases:
        sample = sample_prepared_case()
        cases[sample.case_id] = sample
    return cases
