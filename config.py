"""Configuration and category definitions for Smart File Organizer."""

from pathlib import Path

APP_TITLE = "Smart File Organizer"
HISTORY_PATH = Path.home() / ".smart_file_organizer_history.json"

CATEGORIES = {
    "Images": {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico"},
    "Documents": {".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx", ".csv"},
    "Videos": {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".webm", ".flv"},
    "Audio": {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"},
    "Archives": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"},
    "Code": {".py", ".js", ".ts", ".html", ".css", ".java", ".c", ".cpp", ".h", ".json", ".xml", ".sql"},
}


def category_for(path: Path) -> str:
    """Return a category for a file, matching extensions case-insensitively."""
    extension = path.suffix.lower()
    for category, extensions in CATEGORIES.items():
        if extension in extensions:
            return category
    return "Others"
