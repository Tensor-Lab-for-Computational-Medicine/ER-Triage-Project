from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class CatalogOrder(BaseModel):
    id: str
    type: Literal["lab", "imaging", "study", "procedure", "medication", "intervention"]
    name: str
    aliases: list[str] = Field(default_factory=list)
    result_delay_min: int = 0


def _catalog_path() -> Path:
    return Path(__file__).with_name("catalog.json")


@lru_cache(maxsize=1)
def load_catalog() -> list[CatalogOrder]:
    return [CatalogOrder.model_validate(item) for item in json.loads(_catalog_path().read_text(encoding="utf-8"))]


def get_order(order_id: str) -> CatalogOrder | None:
    for item in load_catalog():
        if item.id == order_id:
            return item
    return None


def search(query: str, limit: int = 10) -> list[CatalogOrder]:
    needle = " ".join(str(query or "").lower().split())
    if not needle:
        return load_catalog()[:limit]

    scored: list[tuple[int, CatalogOrder]] = []
    for item in load_catalog():
        haystacks = [item.name.lower(), item.id.replace("_", " "), *[alias.lower() for alias in item.aliases]]
        best = 0
        for text in haystacks:
            if text == needle:
                best = max(best, 100)
            elif text.startswith(needle):
                best = max(best, 80)
            elif needle in text:
                best = max(best, 65)
            elif all(part in text for part in needle.split()):
                best = max(best, 45)
        if best:
            scored.append((best, item))

    scored.sort(key=lambda row: (-row[0], row[1].name))
    return [item for _, item in scored[:limit]]


def serialize_order(item: CatalogOrder) -> dict:
    return item.model_dump(mode="json")
