"""Fail if restricted credentialed data can leak through git or the public app."""

from __future__ import annotations

import fnmatch
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

RESTRICTED_PATTERNS = [
    "mimic-iv-ext-clinical-decision-support-for-referral-triage-and-diagnosis-*",
    "mimic-iv-ext-clinical-decision-support-for-referral-triage-and-diagnosis-*/*",
    "data/restricted/*",
    "data/restricted/**/*",
    "frontend/src/data/*.restricted*.json",
    "reports/restricted/*",
    "reports/restricted/**/*",
]

IGNORE_SENTINELS = [
    "mimic-iv-ext-clinical-decision-support-for-referral-triage-and-diagnosis-1.0.2",
    "data/restricted/example.json",
    "frontend/src/data/mimic.restricted.json",
    "reports/restricted/audit.json",
]

FRONTEND_SOURCE_GLOBS = ["*.js", "*.jsx", "*.ts", "*.tsx"]
RESTRICTED_STATIC_REFERENCE_MARKERS = [
    "import ",
    " from ",
    "fetch(",
    "new URL(",
    "require(",
]
PUBLIC_BUILD_DIRS = [
    ROOT / "frontend" / "dist",
    ROOT / "frontend" / "public",
]


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode not in {0, 1}:
        raise SystemExit(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout


def matches_restricted(path: str) -> bool:
    normalized = path.strip().rstrip("/")
    return any(fnmatch.fnmatch(normalized, pattern) for pattern in RESTRICTED_PATTERNS)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def check_git_ignore_rules() -> None:
    for sentinel in IGNORE_SENTINELS:
        result = subprocess.run(
            ["git", "check-ignore", "-q", sentinel],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        require(result.returncode == 0, f"Restricted path is not ignored by git: {sentinel}")


def check_tracked_files() -> None:
    tracked = [line for line in run_git(["ls-files"]).splitlines() if line.strip()]
    leaked = [path for path in tracked if matches_restricted(path)]
    require(not leaked, "Restricted files are tracked by git:\n" + "\n".join(leaked))


def check_visible_untracked_files() -> None:
    status = run_git(["status", "--short", "--untracked-files=all", "--ignored=no"])
    leaked: list[str] = []
    for line in status.splitlines():
        if not line.startswith("?? "):
            continue
        path = line[3:].strip()
        if matches_restricted(path):
            leaked.append(path)
    require(not leaked, "Restricted files are visible as untracked git files:\n" + "\n".join(leaked))


def check_public_static_imports() -> None:
    frontend = ROOT / "frontend" / "src"
    if not frontend.exists():
        return
    offenders: list[str] = []
    for pattern in FRONTEND_SOURCE_GLOBS:
        for path in frontend.rglob(pattern):
            for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
                if ".restricted" not in line and "mimic-iv-ext-clinical-decision-support" not in line:
                    continue
                if any(marker in line for marker in RESTRICTED_STATIC_REFERENCE_MARKERS):
                    offenders.append(str(path.relative_to(ROOT)))
                    break
    require(
        not offenders,
        "Public frontend source references restricted data artifacts:\n" + "\n".join(offenders),
    )


def check_public_build_artifacts() -> None:
    offenders: list[str] = []
    for directory in PUBLIC_BUILD_DIRS:
        if not directory.exists():
            continue
        for path in directory.rglob("*"):
            if path.is_file() and matches_restricted(str(path.relative_to(ROOT))):
                offenders.append(str(path.relative_to(ROOT)))
    require(
        not offenders,
        "Restricted data artifacts are present in public build paths:\n" + "\n".join(offenders),
    )


def main() -> None:
    check_git_ignore_rules()
    check_tracked_files()
    check_visible_untracked_files()
    check_public_static_imports()
    check_public_build_artifacts()
    print("Restricted-data privacy checks passed.")


if __name__ == "__main__":
    main()
