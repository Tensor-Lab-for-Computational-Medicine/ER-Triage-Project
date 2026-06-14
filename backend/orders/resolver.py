from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from backend.cases.schemas import PreparedCase, ResultBundle


class ResolvedOrder(BaseModel):
    order_id: str
    status: Literal["resulted", "unavailable"]
    result: ResultBundle | None = None
    unavailable_reason: str | None = None


def resolve(order_id: str, case: PreparedCase, state: object | None = None) -> ResolvedOrder:
    """Return source-recorded data for an order or an explicit unavailable state."""

    if order_id in case.result_bundles:
        return ResolvedOrder(order_id=order_id, status="resulted", result=case.result_bundles[order_id])
    return ResolvedOrder(
        order_id=order_id,
        status="unavailable",
        unavailable_reason="No source-recorded result is available for this order; no value was fabricated.",
    )
