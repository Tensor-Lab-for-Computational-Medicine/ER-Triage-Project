from __future__ import annotations

from backend.cases.schemas import ResultBundle


def format_result(bundle: ResultBundle) -> str:
    lines = [f"{bundle.display_name}"]
    for value in bundle.values:
        rendered = value.value if value.unit is None else f"{value.value} {value.unit}"
        flag = f" [{value.flag}]" if value.flag else ""
        lines.append(f"- {value.name}: {rendered}{flag}")
    if bundle.narrative:
        lines.append(bundle.narrative)
    return "\n".join(lines)
