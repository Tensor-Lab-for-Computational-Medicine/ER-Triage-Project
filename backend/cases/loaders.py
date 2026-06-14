from __future__ import annotations

import json
import logging
from pathlib import Path

from backend.cases.prepare import CasePreparationError, assert_pilot_eligible
from backend.cases.sample_cases import sample_prepared_case
from backend.cases.schemas import PreparedCase


LOGGER = logging.getLogger(__name__)


def load_prepared_case(path: Path) -> PreparedCase:
    case = PreparedCase.model_validate_json(path.read_text(encoding="utf-8"))
    assert_pilot_eligible(case)
    return case


def load_local_cases(data_dir: Path | None = None) -> dict[str, PreparedCase]:
    data_dir = data_dir or Path("data/cases")
    cases: dict[str, PreparedCase] = {}
    if data_dir.exists():
        for path in sorted(data_dir.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))
            case = PreparedCase.model_validate(payload)
            try:
                assert_pilot_eligible(case)
            except CasePreparationError as exc:
                LOGGER.warning("Skipping pilot-ineligible case %s: %s", path, exc)
                continue
            cases[case.case_id] = case
    if not cases:
        sample = sample_prepared_case()
        cases[sample.case_id] = sample
    return cases
