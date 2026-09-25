"""Validate the canonical AquaLink dataset and its frontend publication."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from dataset_validation import compare_datasets, validate_dataframe

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_DIR.parents[1]
DEFAULT_CANONICAL = BACKEND_DIR / "data" / "aqualink_dataset.csv"
DEFAULT_FALLBACK = REPOSITORY_ROOT / "aqualink-dashboard" / "public" / "aqualinkData.csv"
DEFAULT_REPORT = BACKEND_DIR / "data" / "validation_summary.json"


def repository_relative(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(REPOSITORY_ROOT).as_posix()
    except ValueError:
        return resolved.name


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canonical", type=Path, default=DEFAULT_CANONICAL)
    parser.add_argument("--fallback", type=Path, default=DEFAULT_FALLBACK)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    canonical = pd.read_csv(args.canonical)
    fallback = pd.read_csv(args.fallback)
    result = validate_dataframe(canonical)
    fallback_errors = compare_datasets(canonical, fallback)
    report = result.to_dict()
    report["canonical_path"] = repository_relative(args.canonical)
    report["fallback_path"] = repository_relative(args.fallback)
    report["fallback_matches_canonical"] = not fallback_errors
    report["errors"].extend(fallback_errors)
    report["valid"] = result.valid and not fallback_errors

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    status = "PASS" if report["valid"] else "FAIL"
    stats = report["statistics"]
    print(f"Dataset validation: {status}")
    print(
        f"Rows: {stats.get('rows', 0):,} | Locations: {stats.get('locations', 0):,} | "
        f"Years: {stats.get('years', [])} | Districts: {stats.get('districts', 0)} | "
        f"Talukas: {stats.get('talukas', 0)}"
    )
    print(f"Derived mismatches: {report['derived_mismatches']}")
    print(f"Fallback matches canonical: {report['fallback_matches_canonical']}")
    if report["errors"]:
        for error in report["errors"]:
            print(f"ERROR: {error}")
    print(f"Report: {args.report.resolve()}")
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
