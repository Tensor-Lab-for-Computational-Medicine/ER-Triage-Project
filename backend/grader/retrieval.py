from __future__ import annotations

import re
from collections import Counter
from collections.abc import Sequence

from backend.grader.grade import EvidencePassage
from backend.grader.package import CasePackage


_TOKEN = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def retrieve_evidence_passages(
    package: CasePackage,
    evidence_corpus: Sequence[EvidencePassage],
    limit: int = 3,
) -> list[EvidencePassage]:
    """Select grounding passages deterministically; retrieval never grades."""

    if limit <= 0 or not evidence_corpus:
        return []

    query_terms = Counter(_tokens(_package_query(package)))
    if not query_terms:
        return []

    scored: list[tuple[int, int, EvidencePassage]] = []
    for index, passage in enumerate(evidence_corpus):
        passage_terms = Counter(_tokens(f"{passage.title} {passage.text}"))
        score = sum(query_terms[token] * min(passage_terms[token], 3) for token in query_terms)
        if score > 0:
            scored.append((score, index, passage))

    scored.sort(key=lambda row: (-row[0], row[1]))
    return [passage for _, _, passage in scored[:limit]]


def _package_query(package: CasePackage) -> str:
    ordered = " ".join(order.order_id.replace("_", " ") for order in package.orders)
    exams = " ".join(f"{record.display_name} {record.finding}" for record in package.exams)
    interventions = " ".join(f"{record.display_name} {record.effect_summary}" for record in package.interventions)
    transcript = " ".join(message.text for message in package.transcript)
    key_points = " ".join(package.hidden_truth.clinician_key_points)
    return " ".join(
        [
            package.hidden_truth.final_diagnosis,
            package.hidden_truth.actual_disposition,
            package.soap.assessment,
            package.soap.plan,
            ordered,
            exams,
            interventions,
            transcript,
            key_points,
        ]
    )


def _tokens(text: str) -> list[str]:
    return [
        token
        for token in _TOKEN.findall(text.lower())
        if len(token) > 2 and token not in _STOPWORDS
    ]
