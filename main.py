"""Tkinter GUI for the Smart File Organizer MVP."""

from __future__ import annotations

import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from config import APP_TITLE
from organizer import FilePlan, analyze_folder, clear_history, load_history, organize, save_history, undo


class OrganizerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("780x560")
        self.minsize(650, 430)
        self.folder = tk.StringVar()
        self.status = tk.StringVar(value="Choose a folder to begin.")
        self.progress = tk.IntVar(value=0)
        self.plans: list[FilePlan] = []
        self.last_moves: list[dict[str, str]] = load_history()
        self.events: queue.Queue[tuple[str, object]] = queue.Queue()
        self._build_ui()
        self.after(100, self._process_events)

    def _build_ui(self) -> None:
        outer = ttk.Frame(self, padding=16)
        outer.pack(fill="both", expand=True)
        ttk.Label(outer, text=APP_TITLE, font=("Segoe UI", 18, "bold")).pack(anchor="w")
        ttk.Label(outer, text="Sort files in the selected folder (subfolders are not scanned).").pack(anchor="w", pady=(2, 14))

        selection = ttk.Frame(outer)
        selection.pack(fill="x")
        ttk.Entry(selection, textvariable=self.folder).pack(side="left", fill="x", expand=True)
        ttk.Button(selection, text="Browse...", command=self._browse).pack(side="left", padx=(8, 0))
        actions = ttk.Frame(outer)
        actions.pack(fill="x", pady=10)
        self.analyze_button = ttk.Button(actions, text="Analyze", command=self._analyze)
        self.analyze_button.pack(side="left")
        self.organize_button = ttk.Button(actions, text="Organize", command=self._start_organize, state="disabled")
        self.organize_button.pack(side="left", padx=8)
        self.undo_button = ttk.Button(actions, text="Undo last organization", command=self._start_undo,
                                      state="normal" if self.last_moves else "disabled")
        self.undo_button.pack(side="left")

        self.preview = tk.Text(outer, height=16, width=80, state="disabled", wrap="none")
        self.preview.pack(fill="both", expand=True)
        ttk.Progressbar(outer, variable=self.progress, maximum=100).pack(fill="x", pady=(10, 4))
        ttk.Label(outer, textvariable=self.status).pack(anchor="w")

    def _browse(self) -> None:
        selected = filedialog.askdirectory(title="Select folder to organize")
        if selected:
            self.folder.set(selected)
            self._analyze()

    def _analyze(self) -> None:
        try:
            self.plans = analyze_folder(Path(self.folder.get()))
        except ValueError as error:
            messagebox.showerror(APP_TITLE, str(error))
            return
        self.preview.configure(state="normal")
        self.preview.delete("1.0", "end")
        if self.plans:
            for plan in self.plans:
                self.preview.insert("end", f"{plan.source.name}  ->  {plan.category}/\n")
            self.status.set(f"{len(self.plans)} file(s) ready. Review the preview, then choose Organize.")
            self.organize_button.configure(state="normal")
        else:
            self.preview.insert("end", "No visible files found in this folder.")
            self.status.set("Nothing to organize.")
            self.organize_button.configure(state="disabled")
        self.preview.configure(state="disabled")

    def _set_busy(self, busy: bool) -> None:
        state = "disabled" if busy else "normal"
        self.analyze_button.configure(state=state)
        self.organize_button.configure(state="disabled" if busy or not self.plans else "normal")
        self.undo_button.configure(state="disabled" if busy or not self.last_moves else "normal")

    def _start_organize(self) -> None:
        if not self.plans or not messagebox.askyesno(APP_TITLE, "Organize the files shown in the preview?"):
            return
        self._set_busy(True)
        self.progress.set(0)
        threading.Thread(target=self._organize_worker, args=(self.plans,), daemon=True).start()

    def _organize_worker(self, plans: list[FilePlan]) -> None:
        moves = organize(plans, lambda current, total, message: self.events.put(("progress", (current, total, message))))
        try:
            save_history(moves)
        except OSError as error:
            self.events.put(("error", f"Could not save undo history: {error}"))
        self.events.put(("organized", moves))

    def _start_undo(self) -> None:
        if not self.last_moves or not messagebox.askyesno(APP_TITLE, "Undo the last organization?"):
            return
        self._set_busy(True)
        threading.Thread(target=self._undo_worker, args=(self.last_moves,), daemon=True).start()

    def _undo_worker(self, moves: list[dict[str, str]]) -> None:
        result = undo(moves)
        if not result[1]:
            clear_history()
        self.events.put(("undone", result))

    def _process_events(self) -> None:
        try:
            while True:
                event, payload = self.events.get_nowait()
                if event == "progress":
                    current, total, message = payload
                    self.progress.set(round(current / total * 100) if total else 100)
                    self.status.set(message)
                elif event == "organized":
                    self.last_moves = payload
                    self.plans = []
                    self._set_busy(False)
                    self.organize_button.configure(state="disabled")
                    self.status.set(f"Done. Organized {len(payload)} file(s).")
                elif event == "undone":
                    restored, errors = payload
                    self.last_moves = []
                    self.plans = []
                    self.preview.configure(state="normal")
                    self.preview.delete("1.0", "end")
                    self.preview.configure(state="disabled")
                    self.progress.set(0)
                    self._set_busy(False)
                    self.organize_button.configure(state="disabled")
                    self.undo_button.configure(state="disabled")
                    self.status.set(
                        f"Undo complete: restored {restored} file(s). "
                        "Click Analyze to scan the folder again."
                    )
                    if errors:
                        self._log("\n".join(errors))
                elif event == "error":
                    self._log(str(payload))
        except queue.Empty:
            pass
        self.after(100, self._process_events)

    def _log(self, message: str) -> None:
        self.preview.configure(state="normal")
        self.preview.insert("end", f"\n{message}\n")
        self.preview.configure(state="disabled")


if __name__ == "__main__":
    OrganizerApp().mainloop()
