"""Command-line library import.

Run from the backend directory:

    python -m app.importers ..\\examples --library demo
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.importers.errors import ScanError
from app.importers.inventory import scan_directory
from app.storage.project_store import upsert_library


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Inventory an HDL library without starting the studio.")
    parser.add_argument("path", help="Library directory. A relative path is resolved from the repository root.")
    parser.add_argument("--library", help="Logical library name. Defaults to the directory name.")
    parser.add_argument("--out", help="Write the import report JSON to this file.")
    parser.add_argument("--no-save", action="store_true", help="Do not update workspace/project.json.")
    args = parser.parse_args(argv)
    try:
        library, units = scan_directory(args.path, args.library)
        if not args.no_save:
            upsert_library(library, units)
    except ScanError as exc:
        print(f"{exc.code}: {exc.message}", file=sys.stderr)
        return 2
    report = library.last_import
    if report is None:
        print("scan_failed: the importer did not produce a report.", file=sys.stderr)
        return 2
    if args.out:
        destination = Path(args.out)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(report.model_dump_json(indent=2), encoding="utf-8")
    counts = report.counts
    print(f"library {library.name} ({library.id})")
    print(f"root {library.root_path}")
    print(
        "files {files}, entities {entities}, architectures {architectures}, "
        "packages {packages}, warnings {warnings}, errors {errors}".format(**counts)
    )
    print(f"design units {len(units)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
