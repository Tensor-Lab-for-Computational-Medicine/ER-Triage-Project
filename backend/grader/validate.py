from __future__ import annotations

from pydantic import BaseModel, Field

from backend.grader.grade import ClinicianRubric, EvidencePassage, grade_case_package
from backend.grader.package import CasePackage


class ValidationCaseResult(BaseModel):
    case_id: str
    diagnostic_match: bool
    esi_match: bool
    disposition_present: bool


class ValidationReport(BaseModel):
    cases: list[ValidationCaseResult] = Field(default_factory=list)
    diagnostic_agreement: float
    esi_agreement: float
    disposition_documentation_rate: float
    release_blocked: bool
    failure_modes: list[str] = Field(default_factory=list)


def run_validation(
    packages: list[CasePackage],
    rubric: ClinicianRubric,
    evidence_passages: list[EvidencePassage],
    threshold: float = 0.8,
) -> ValidationReport:
    rows: list[ValidationCaseResult] = []
    for package in packages:
        feedback = grade_case_package(package, rubric, evidence_passages)
        disposition_text = f"{package.soap.plan} {package.hidden_truth.actual_disposition}".lower()
        rows.append(
            ValidationCaseResult(
                case_id=package.case_id,
                diagnostic_match=bool(feedback.diagnostic_accuracy["matched"]),
                esi_match=feedback.acuity["last_committed_esi"] == package.hidden_truth.validated_esi,
                disposition_present=package.hidden_truth.actual_disposition.lower().split()[0] in disposition_text,
            )
        )

    total = max(1, len(rows))
    diagnostic_agreement = sum(row.diagnostic_match for row in rows) / total
    esi_agreement = sum(row.esi_match for row in rows) / total
    disposition_rate = sum(row.disposition_present for row in rows) / total
    failure_modes = []
    if diagnostic_agreement < threshold:
        failure_modes.append("diagnostic agreement below clinician threshold")
    if esi_agreement < threshold:
        failure_modes.append("ESI agreement below clinician threshold")
    if disposition_rate < threshold:
        failure_modes.append("disposition documentation below clinician threshold")

    return ValidationReport(
        cases=rows,
        diagnostic_agreement=diagnostic_agreement,
        esi_agreement=esi_agreement,
        disposition_documentation_rate=disposition_rate,
        release_blocked=bool(failure_modes),
        failure_modes=failure_modes,
    )
