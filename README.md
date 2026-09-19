# Smart File Organizer

A lightweight Windows-friendly Python/Tkinter MVP that organizes files in one selected folder.

## Features

- Non-recursive folder analysis with hidden-file skipping.
- Case-insensitive categories for images, documents, videos, audio, archives, code, and other files.
- Preview before any move, followed by an explicit **Organize** action.
- Collision-safe names such as `report (1).pdf`; existing files are never overwritten.
- Per-file error handling, progress, status messages, and an operation log.
- Responsive organization and undo through worker threads.
- In-memory undo plus a simple optional JSON history file at `~/.smart_file_organizer_history.json`.

## Run on Windows

Install Python 3.10 or newer, then run:

```powershell
python main.py
```

Select a folder, review the preview, and click **Organize**. The application only examines files directly inside the selected folder; it does not scan existing category subfolders.

## Development

No package installation is required:

```powershell
python -m py_compile main.py organizer.py config.py
```
