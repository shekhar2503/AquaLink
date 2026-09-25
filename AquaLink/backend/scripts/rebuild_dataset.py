"""Recalculate engine-owned fields and publish the frontend fallback CSV."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil

import pandas as pd

from dataset_validation import ENGINE_COLUMNS, calculate_engine_columns

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_DIR.parents[1]
DEFAULT_CANONICAL = BACKEND_DIR / "data" / "aqualink_dataset.csv"
DEFAULT_FALLBACK = REPOSITORY_ROOT / "aqualink-dashboard" / "public" / "aqualinkData.csv"
DEFAULT_BACKUP_DIR = BACKEND_DIR / "data" / "backups"


def atomic_write_csv(frame: pd.DataFrame, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    frame.to_csv(temporary, index=False, lineterminator="\n")
    os.replace(temporary, destination)


def create_backup(source: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = backup_dir / f"{source.stem}.before_engine_repair.{timestamp}{source.suffix}"
    shutil.copy2(source, backup)
    return backup


def rebuild(canonical_path: Path, fallback_path: Path, backup_dir: Path | None) -> dict:
    frame = pd.read_csv(canonical_path)
    expected = calculate_engine_columns(frame)
    before = {}
    for column in ENGINE_COLUMNS:
        if column.endswith("_Score"):
            before[column] = int((frame[column].round(10) != expected[column].round(10)).sum())
        else:
            before[column] = int((frame[column].astype(str) != expected[column]).sum())

    backup = create_backup(canonical_path, backup_dir) if backup_dir else None
    frame.loc[:, ENGINE_COLUMNS] = expected[ENGINE_COLUMNS]
    atomic_write_csv(frame, canonical_path)

    # The fallback is an exact publication of the repaired canonical dataset.
    # This keeps API and offline mode on the same years, rows, and score version.
    atomic_write_csv(frame, fallback_path)

    return {
        "rows": len(frame),
        "years": sorted(int(year) for year in frame["Year"].unique()),
        "changed_before_repair": before,
        "backup": str(backup) if backup else None,
        "canonical": str(canonical_path),
        "fallback": str(fallback_path),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canonical", type=Path, default=DEFAULT_CANONICAL)
    parser.add_argument("--fallback", type=Path, default=DEFAULT_FALLBACK)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    parser.add_argument("--no-backup", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    summary = rebuild(
        args.canonical.resolve(),
        args.fallback.resolve(),
        None if args.no_backup else args.backup_dir.resolve(),
    )
    print("AquaLink dataset rebuilt")
    print(f"Rows: {summary['rows']:,}")
    print(f"Years: {summary['years']}")
    print(f"Pre-repair mismatches: {summary['changed_before_repair']}")
    if summary["backup"]:
        print(f"Original backup: {summary['backup']}")
    print(f"Canonical CSV: {summary['canonical']}")
    print(f"Frontend fallback: {summary['fallback']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
