"""Remember the library form between browser sessions.

``workspace/ui.json`` stores only the path and name the user typed. It does
not copy the library.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.paths import ui_file


class UiSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    library_path: str = ""
    library_name: str = "demo"
    include_side_data: bool = False
    board_id: str = ""
    hierarchy_root_id: str = ""


def load_ui() -> UiSettings:
    path = ui_file()
    if not path.is_file():
        return UiSettings()
    return UiSettings.model_validate_json(path.read_text(encoding="utf-8"))


def save_ui(settings: UiSettings) -> UiSettings:
    path = ui_file()
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(settings.model_dump_json(indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    return settings
