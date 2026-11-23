"""Remember the library form between browser sessions.

``workspace/ui.json`` stores the path and name the user typed, the selected
board, the hierarchy root, the studio text size, and the port-label form.
The VHDL language standard is project configuration in ``project.json``, not a studio preference.
This file does not copy a library or a diagram.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.paths import ui_file


class UiSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    library_path: str = ""
    library_name: str = "demo"
    include_side_data: bool = False
    board_id: str = ""
    hierarchy_root_id: str = ""
    state_text_px: int = 13
    port_label_style: Literal["short", "long"] = "short"

    @field_validator("state_text_px", mode="before")
    @classmethod
    def clamp_state_text_px(cls, value: object) -> int:
        if isinstance(value, bool) or value is None:
            return 13
        if isinstance(value, (int, float)):
            number = int(round(float(value)))
        elif isinstance(value, str):
            try:
                number = int(round(float(value)))
            except ValueError:
                return 13
        else:
            return 13
        return min(16, max(8, number))

    @field_validator("port_label_style", mode="before")
    @classmethod
    def normalize_port_label_style(cls, value: object) -> str:
        return "long" if value == "long" else "short"


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
