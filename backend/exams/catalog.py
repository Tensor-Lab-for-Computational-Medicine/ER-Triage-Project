from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


ManeuverType = Literal["inspection", "palpation", "auscultation", "percussion", "special tests"]


class ExamManeuver(BaseModel):
    id: str
    region: str
    maneuver_type: ManeuverType
    name: str
    aliases: list[str] = Field(default_factory=list)


def _catalog_path() -> Path:
    return Path(__file__).with_name("catalog.json")


@lru_cache(maxsize=1)
def load_exam_catalog() -> list[ExamManeuver]:
    return [ExamManeuver.model_validate(item) for item in json.loads(_catalog_path().read_text(encoding="utf-8"))]


def get_maneuver(maneuver_id: str) -> ExamManeuver | None:
    normalized = str(maneuver_id or "").strip().lower().replace(" ", "_")
    for item in load_exam_catalog():
        if item.id == normalized:
            return item
    return None


def search_exams(query: str, limit: int = 12) -> list[ExamManeuver]:
    needle = " ".join(str(query or "").lower().split())
    if not needle:
        return load_exam_catalog()[:limit]

    scored: list[tuple[int, ExamManeuver]] = []
    for item in load_exam_catalog():
        haystacks = [
            item.name.lower(),
            item.id.replace("_", " "),
            item.region.lower(),
            item.maneuver_type.lower(),
            *[alias.lower() for alias in item.aliases],
        ]
        best = 0
        for text in haystacks:
            if text == needle:
                best = max(best, 100)
            elif text.startswith(needle):
                best = max(best, 85)
            elif needle in text:
                best = max(best, 70)
            elif all(part in text for part in needle.split()):
                best = max(best, 50)
        if best:
            scored.append((best, item))

    scored.sort(key=lambda row: (-row[0], row[1].region, row[1].maneuver_type, row[1].name))
    return [item for _, item in scored[:limit]]


def browse_tree() -> dict[str, dict[str, list[dict]]]:
    tree: dict[str, dict[str, list[dict]]] = {}
    for item in load_exam_catalog():
        tree.setdefault(item.region, {}).setdefault(item.maneuver_type, []).append(serialize_maneuver(item))
    for region in tree:
        for maneuver_type in tree[region]:
            tree[region][maneuver_type].sort(key=lambda item: item["name"])
    return dict(sorted(tree.items()))


def serialize_maneuver(item: ExamManeuver) -> dict:
    return item.model_dump(mode="json")
