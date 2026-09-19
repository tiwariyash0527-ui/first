"""File analysis, organization, and undo operations."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from config import HISTORY_PATH, category_for


@dataclass(frozen=True)
class FilePlan:
    source: Path
    category: str
    destination: Path


def analyze_folder(folder: Path) -> list[FilePlan]:
    """Build a non-recursive plan, skipping hidden files and directories."""
    folder = Path(folder)
    if not folder.is_dir():
        raise ValueError("Please select an existing folder.")

    plans = []
    for item in sorted(folder.iterdir(), key=lambda path: path.name.lower()):
        if item.is_file() and not item.name.startswith("."):
            category = category_for(item)
            plans.append(FilePlan(item, category, folder / category / item.name))
    return plans


def _unique_destination(destination: Path, reserved: set[Path]) -> Path:
    """Choose a non-overwriting destination using a readable numeric suffix."""
    candidate = destination
    counter = 1
    while candidate.exists() or candidate in reserved:
        candidate = destination.with_name(
            f"{destination.stem} ({counter}){destination.suffix}"
        )
        counter += 1
    reserved.add(candidate)
    return candidate


def organize(
    plans: Iterable[FilePlan],
    progress: Callable[[int, int, str], None] | None = None,
) -> list[dict[str, str]]:
    """Move planned files, continuing after individual errors.

    Returns successful moves as JSON-friendly source/destination records.
    """
    plans = list(plans)
    moves = []
    reserved: set[Path] = set()
    total = len(plans)
    for index, plan in enumerate(plans, start=1):
        try:
            plan.destination.parent.mkdir(parents=True, exist_ok=True)
            destination = _unique_destination(plan.destination, reserved)
            shutil.move(str(plan.source), str(destination))
            moves.append({"source": str(plan.source), "destination": str(destination)})
            message = f"Moved {plan.source.name} to {destination.parent.name}/"
        except (OSError, shutil.Error) as error:
            message = f"Error with {plan.source.name}: {error}"
        if progress:
            progress(index, total, message)
    return moves


def save_history(moves: list[dict[str, str]], history_path: Path = HISTORY_PATH) -> None:
    """Persist the latest successful operation when a history path is supplied."""
    if not moves:
        return
    history_path = Path(history_path)
    history_path.parent.mkdir(parents=True, exist_ok=True)
    history_path.write_text(json.dumps(moves, indent=2), encoding="utf-8")


def load_history(history_path: Path = HISTORY_PATH) -> list[dict[str, str]]:
    try:
        data = json.loads(Path(history_path).read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def undo(moves: Iterable[dict[str, str]]) -> tuple[int, list[str]]:
    """Move files back where possible, never overwriting an existing file."""
    restored = 0
    errors = []
    for record in reversed(list(moves)):
        source = Path(record["source"])
        destination = Path(record["destination"])
        try:
            if not destination.exists():
                errors.append(f"Missing organized file: {destination.name}")
                continue
            if source.exists():
                errors.append(f"Skipped restore (file exists): {source.name}")
                continue
            source.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(destination), str(source))
            restored += 1
        except (OSError, shutil.Error) as error:
            errors.append(f"Error restoring {destination.name}: {error}")
    return restored, errors
