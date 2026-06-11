"""Audit generated simulation text against case evidence atoms.

This is a deterministic first-pass guardrail for ML-fellow validation. It does
not prove clinical correctness; it highlights unsupported or contradicted claims
that need review before learners or clinicians use LLM-generated content.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "reports" / "restricted" / "grounding_audit.restricted.json"

RISKY_PATTERNS = {
    "diagnosis": re.compile(r"\b(diagnos|differential|pneumonia|sepsis|fracture|stroke|embol|infarct|appendicitis|ulcer|failure|infection)\b", re.I),
    "medication": re.compile(r"\b(medication|antibiotic|opioid|ketorolac|acetaminophen|aspirin|heparin|insulin|vancomycin|ceftriaxone|dose|mg|mcg)\b", re.I),
    "test": re.compile(r"\b(test|lab|cbc|cmp|troponin|lactate|culture|x-?ray|ct|mri|ultrasound|ecg|ekg|imaging)\b", re.I),
    "treatment": re.compile(r"\b(treat|start|give|administer|bolus|fluid|intubat|oxygen|consult|procedure|surgery|admit|discharge)\b", re.I),
    "disposition": re.compile(r"\b(discharge|admit|admission|transfer|home|icu|floor|ward|observation)\b", re.I),
    "esi": re.compile(r"\bESI\s*([1-5])\b", re.I),
}

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "patient",
    "case",
    "from",
    "into",
    "after",
    "before",
    "should",
    "would",
    "could",
    "needs",
    "need",
}


def compact_text(value: Any) -> str:
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def is_gitignored(path: Path) -> bool:
    try:
        relative = path.resolve().relative_to(ROOT)
    except ValueError:
        return False
    result = subprocess.run(
        ["git", "check-ignore", "-q", str(relative)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def assert_restricted_output(path: Path) -> None:
    if not is_gitignored(path):
        raise SystemExit(f"Refusing to write grounding audit to non-ignored path: {path}")


def case_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("cases"), list):
        return payload["cases"]
    raise SystemExit("Case input must be a list or an object with a cases list.")


def output_items(payload: Any) -> list[dict[str, str]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("outputs"), list):
        return payload["outputs"]
    if isinstance(payload, dict):
        items = []
        for case_id, value in payload.items():
            if isinstance(value, str):
                items.append({"case_id": case_id, "section": "generated", "text": value})
            elif isinstance(value, dict):
                for section, text in value.items():
                    if isinstance(text, str):
                        items.append({"case_id": case_id, "section": section, "text": text})
        return items
    raise SystemExit("Output input must be a list, an outputs list, or a case_id object map.")


def knowledge_chunks(payload: Any) -> dict[str, dict[str, Any]]:
    if not payload:
        return {}
    if isinstance(payload, dict) and payload.get("schema_version") in {
        "clinical_knowledge_bundle_v1",
        "clinical_knowledge_bundle_v2",
    }:
        sources = {source.get("id"): source for source in payload.get("sources", [])}
        chunks = {}
        for chunk in payload.get("chunks", []) or []:
            source = sources.get(chunk.get("source_id"), {})
            chunks[chunk.get("id")] = {
                **chunk,
                "source": source,
            }
        return {key: value for key, value in chunks.items() if key}
    if isinstance(payload, dict) and isinstance(payload.get("chunks"), list):
        return {chunk.get("id"): chunk for chunk in payload["chunks"] if chunk.get("id")}
    return {}


def sentence_split(text: str) -> list[str]:
    return [
        compact_text(part)
        for part in re.split(r"(?<=[.!?])\s+|\n+", compact_text(text))
        if compact_text(part)
    ]


def tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", text.lower())
        if token not in STOPWORDS
    }


def evidence_atoms(case: dict[str, Any]) -> list[dict[str, str]]:
    atoms: list[dict[str, str]] = []

    def add(domain: str, text: Any, provenance: str = "source_record", atom_id: str = "") -> None:
        cleaned = compact_text(text)
        if cleaned:
            atoms.append({"id": atom_id, "domain": domain, "text": cleaned, "provenance": provenance})

    add("complaint", case.get("complaint"), atom_id="case_chief_complaint")
    add("history", case.get("history"), atom_id="case_triage_history")
    add("disposition", case.get("disposition"), atom_id="case_disposition")
    if case.get("acuity"):
        add("esi", f"ESI {case.get('acuity')}", atom_id="case_reference_esi")

    for item in case.get("documented_evidence", []) or []:
        add(
            item.get("domain", "documented_evidence"),
            item.get("statement"),
            item.get("provenance", "source_record"),
            item.get("id", ""),
        )

    source = case.get("source", {}) or {}
    for key in ["triage_narrative", "chief_complaint", "disposition"]:
        add(key, source.get(key))

    ground_truth = case.get("ground_truth", {}) or {}
    diagnoses = ground_truth.get("diagnoses", {}) or {}
    if isinstance(diagnoses, dict):
        for value in diagnoses.get("primary", []) or []:
            add("primary_diagnosis", value)
        for value in diagnoses.get("secondary", []) or []:
            add("secondary_diagnosis", value)
        add("icd_title", (diagnoses.get("icd") or {}).get("title"))
        add("diagnosis", diagnoses.get("raw_diagnosis_text"))
    add("tests", ground_truth.get("tests"))
    add("past_medication", ground_truth.get("past_medication"))

    augmentation = case.get("augmentation", {}) or {}
    for fact in augmentation.get("inferred_facts", []) or []:
        if fact.get("review_status") == "reviewed":
            add(fact.get("domain", "reviewed_inference"), fact.get("statement"), "reviewed_teaching_inference")

    return atoms


def risky_domains(sentence: str) -> list[str]:
    domains = []
    for domain, pattern in RISKY_PATTERNS.items():
        if pattern.search(sentence):
            domains.append(domain)
    return domains


def evidence_support(sentence: str, atoms: list[dict[str, str]]) -> dict[str, Any] | None:
    sentence_tokens = tokens(sentence)
    if not sentence_tokens:
        return None
    best: tuple[float, dict[str, str]] | None = None
    lowered = sentence.lower()
    for atom in atoms:
        atom_text = atom["text"]
        atom_tokens = tokens(atom_text)
        if not atom_tokens:
            continue
        if lowered in atom_text.lower() or atom_text.lower() in lowered:
            score = 1.0
        else:
            overlap = len(sentence_tokens & atom_tokens)
            score = overlap / max(len(sentence_tokens), 1)
        if score >= 0.35 and (best is None or score > best[0]):
            best = (score, atom)
    if best is None:
        return None
    return {"score": round(best[0], 3), "atom": best[1]}


def contradiction(sentence: str, case: dict[str, Any]) -> str:
    esi_match = RISKY_PATTERNS["esi"].search(sentence)
    if esi_match and case.get("acuity") and str(case["acuity"]) != esi_match.group(1):
        return f"mentions ESI {esi_match.group(1)} but reference ESI is {case['acuity']}"

    disposition = compact_text(case.get("disposition")).lower()
    lowered = sentence.lower()
    if disposition:
        says_discharge = re.search(r"\b(discharge|home)\b", lowered)
        says_admit = re.search(r"\b(admit|admission|floor|ward)\b", lowered)
        if "admit" in disposition and says_discharge:
            return f"mentions discharge/home but source disposition is {case.get('disposition')}"
        if ("home" in disposition or "discharge" in disposition) and says_admit:
            return f"mentions admission but source disposition is {case.get('disposition')}"
    return ""


def audit_sentence(sentence: str, case: dict[str, Any], atoms: list[dict[str, str]]) -> dict[str, Any]:
    domains = risky_domains(sentence)
    reason = contradiction(sentence, case)
    if reason:
        return {"status": "contradicted", "domains": domains, "claim": sentence, "reason": reason}
    support = evidence_support(sentence, atoms)
    if support:
        return {
            "status": "supported",
            "domains": domains,
            "claim": sentence,
            "support": support["atom"],
            "support_score": support["score"],
        }
    if domains:
        return {"status": "unsupported", "domains": domains, "claim": sentence, "reason": "no matching case evidence atom"}
    return {"status": "not_risky", "domains": [], "claim": sentence}


def normalize_id_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [compact_text(item) for item in value if compact_text(item)]
    cleaned = compact_text(value)
    return [cleaned] if cleaned else []


def case_atom_ids(atoms: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    indexed = {}
    for index, atom in enumerate(atoms, start=1):
        base = compact_text(atom.get("id") or atom.get("case_evidence_id") or "")
        if base:
            indexed[base] = atom
        indexed[f"case_atom_{index}"] = atom
    return indexed


def audit_cited_claims(
    output: dict[str, Any],
    case: dict[str, Any],
    atoms: list[dict[str, str]],
    clinical_chunks: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    atom_ids = case_atom_ids(atoms)
    reports = []
    for index, claim in enumerate(output.get("claims", []) or [], start=1):
        text = compact_text(claim.get("text") or claim.get("claim"))
        case_refs = normalize_id_list(claim.get("case_evidence_ids") or claim.get("case_evidence_id"))
        reference_refs = normalize_id_list(claim.get("reference_chunk_ids") or claim.get("reference_chunk_id"))
        domains = risky_domains(text)
        reason = contradiction(text, case)
        if reason:
            reports.append({
                "status": "contradicted",
                "domains": domains,
                "claim": text,
                "reason": reason,
                "case_evidence_ids": case_refs,
                "reference_chunk_ids": reference_refs,
            })
            continue

        invalid_case_refs = [ref for ref in case_refs if ref not in atom_ids]
        invalid_reference_refs = [ref for ref in reference_refs if ref not in clinical_chunks]
        if invalid_case_refs or invalid_reference_refs:
            reports.append({
                "status": "unsupported",
                "domains": domains,
                "claim": text,
                "reason": "claim cites evidence that was not available to the generation",
                "invalid_case_evidence_ids": invalid_case_refs,
                "invalid_reference_chunk_ids": invalid_reference_refs,
            })
            continue

        stale_refs = [
            ref for ref in reference_refs
            if clinical_chunks.get(ref, {}).get("superseded_by") or clinical_chunks.get(ref, {}).get("active") is False
        ]
        if stale_refs:
            reports.append({
                "status": "stale_source",
                "domains": domains,
                "claim": text,
                "reason": "claim cites superseded or inactive clinical source chunks",
                "reference_chunk_ids": stale_refs,
            })
            continue

        license_violations = [
            ref for ref in reference_refs
            if clinical_chunks.get(ref, {}).get("source", {}).get("external_ai_use_allowed") is False
        ]
        if license_violations:
            reports.append({
                "status": "license_violation",
                "domains": domains,
                "claim": text,
                "reason": "claim cites a source that is not allowed for external AI use",
                "reference_chunk_ids": license_violations,
            })
            continue

        if case_refs:
            reports.append({
                "status": "case_supported",
                "domains": domains,
                "claim": text,
                "case_evidence_ids": case_refs,
                "reference_chunk_ids": reference_refs,
            })
        elif reference_refs:
            reports.append({
                "status": "clinical_supported",
                "domains": domains,
                "claim": text,
                "reference_chunk_ids": reference_refs,
            })
        else:
            reports.append({
                "status": "unsupported",
                "domains": domains,
                "claim": text,
                "reason": "claim has no case or clinical citation",
            })
    return reports


def audit(cases: list[dict[str, Any]], outputs: list[dict[str, str]], clinical_chunks: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    cases_by_id = {case["id"]: case for case in cases}
    clinical_chunks = clinical_chunks or {}
    by_status: Counter[str] = Counter()
    by_domain: dict[str, Counter[str]] = defaultdict(Counter)
    by_task: dict[str, Counter[str]] = defaultdict(Counter)
    case_reports = []

    for output in outputs:
        case_id = output.get("case_id")
        case = cases_by_id.get(str(case_id))
        if not case:
            case_reports.append({
                "case_id": case_id,
                "section": output.get("section", "generated"),
                "error": "case_id not found in case bundle",
            })
            by_status["missing_case"] += 1
            continue

        atoms = evidence_atoms(case)
        claims = audit_cited_claims(output, case, atoms, clinical_chunks) if output.get("claims") else [
            audit_sentence(sentence, case, atoms)
            for sentence in sentence_split(output.get("text", ""))
        ]
        risky_claims = [claim for claim in claims if claim["status"] != "not_risky"]
        counts = Counter(claim["status"] for claim in risky_claims)
        for claim in risky_claims:
            by_status[claim["status"]] += 1
            for domain in claim.get("domains", []) or ["uncategorized"]:
                by_domain[domain][claim["status"]] += 1
            task = output.get("task") or output.get("section") or "generated"
            by_task[task][claim["status"]] += 1
        case_reports.append({
            "case_id": case_id,
            "section": output.get("section", "generated"),
            "task": output.get("task", output.get("section", "generated")),
            "claim_counts": dict(counts),
            "claims": risky_claims,
        })

    return {
        "schema_version": "grounding_audit_v1",
        "summary": {
            "outputs_audited": len(outputs),
            "claim_counts": dict(by_status),
            "domain_counts": {domain: dict(counts) for domain, counts in by_domain.items()},
            "task_counts": {task: dict(counts) for task, counts in by_task.items()},
        },
        "failure_modes": sorted(
            domain
            for domain, counts in by_domain.items()
            if counts.get("unsupported", 0) or counts.get("contradicted", 0)
        ),
        "guardrails": [
            "Do not present unsupported diagnosis, medication, testing, treatment, disposition, or ESI claims as source truth.",
            "Generated clinical claims should cite supplied case_evidence_id values for case facts and reference_chunk_id values for clinical literature or textbook rules.",
            "Label LLM-generated assessment and plan text as LLM draft until reviewed.",
            "Use MIMIC-derived retrospective tests, medications, diagnoses, and disposition only in local restricted validation or debrief grounding.",
        ],
        "cases": case_reports,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit generated text against case evidence atoms.")
    parser.add_argument("--cases", required=True, help="Case bundle JSON: public v1 list or restricted v2 bundle.")
    parser.add_argument("--outputs", required=True, help="Generated output JSON to audit.")
    parser.add_argument("--knowledge", help="Optional clinical_knowledge_bundle_v1/v2 JSON for validating reference_chunk_id citations.")
    parser.add_argument("--out", default=str(DEFAULT_OUTPUT), help="Ignored report path.")
    args = parser.parse_args()

    output = Path(args.out).expanduser().resolve()
    assert_restricted_output(output)
    knowledge = knowledge_chunks(read_json(Path(args.knowledge))) if args.knowledge else {}
    report = audit(case_list(read_json(Path(args.cases))), output_items(read_json(Path(args.outputs))), knowledge)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote grounding audit to {output}")


if __name__ == "__main__":
    main()
