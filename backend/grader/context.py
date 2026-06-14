from __future__ import annotations

from typing import Any

from backend.cases.schemas import PreparedCase
from backend.state.engine import CaseState


def grader_context(case: PreparedCase, state: CaseState) -> dict[str, Any]:
    """The only context builder that intentionally reads HiddenTruth."""

    ordered_ids = set(state.active_orders)
    unordered_results = {
        order_id: bundle.model_dump(mode="json")
        for order_id, bundle in case.result_bundles.items()
        if order_id not in ordered_ids
    }
    return {
        "hidden_truth": case.hidden_truth.model_dump(mode="json"),
        "unordered_results": unordered_results,
        "real_timeline": [event.model_dump(mode="json") for event in case.real_timeline],
    }
