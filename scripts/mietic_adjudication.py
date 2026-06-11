"""MIETIC expert-review adjudication helpers.

The public simulator should expose only the minimum teaching adjudication needed
to justify retained cases. Reviewer-level details and MIMIC identifiers stay out
of public bundles.
"""

from __future__ import annotations

from typing import Any

import pandas as pd


EXPERT_FIELDS = ["Expert 1 Opinion", "Expert 2 Opinion", "Expert 3 Opinion"]


def _clean(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value or "").strip().upper()


def adjudicate_mietic_row(row: pd.Series) -> dict[str, Any]:
    """Apply the published MIETIC expert-review rule to one validation row.

    Rule: when Expert 1 and Expert 2 are inconsistent, Expert 3 is the
    definitive judgment. Otherwise the first two reviewers define consensus.
    The dataset's Final Decision is retained as the case inclusion decision.
    """

    expert_1 = _clean(row.get("Expert 1 Opinion"))
    expert_2 = _clean(row.get("Expert 2 Opinion"))
    expert_3 = _clean(row.get("Expert 3 Opinion"))
    final_decision = _clean(row.get("Final Decision"))

    inconsistent_primary = bool(expert_1 and expert_2 and expert_1 != expert_2)
    definitive_opinion = expert_3 if inconsistent_primary and expert_3 else expert_1 or expert_2 or expert_3
    if not definitive_opinion and final_decision == "RETAIN":
        definitive_opinion = "AGREE"
    elif not definitive_opinion and final_decision == "REMOVE":
        definitive_opinion = "DISAGREE"

    return {
        "final_decision": final_decision,
        "definitive_opinion": definitive_opinion,
        "rule": "expert_3_breaks_expert_1_2_disagreement" if inconsistent_primary else "expert_1_2_consensus_or_single_available_review",
        "expert_review_count": sum(1 for value in [expert_1, expert_2, expert_3] if value),
        "primary_reviewer_disagreement": inconsistent_primary,
    }


def retained_by_adjudication(row: pd.Series) -> bool:
    return adjudicate_mietic_row(row)["final_decision"] == "RETAIN"
