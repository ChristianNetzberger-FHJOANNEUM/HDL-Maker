"""Local tool paths for this machine.

``workspace/tools.json`` stores the GTKWave executable. It is not a diagram,
not ``ui.json``, and not part of the VHDL project.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator

from app.paths import tools_file


class ToolSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    gtkwave_path: str = ""
    vivado_path: str = ""

    @field_validator("gtkwave_path")
    @classmethod
    def strip_path(cls, value: object) -> str:
        if not isinstance(value, str):
            return ""
        return value.strip()

    @field_validator("vivado_path")
    @classmethod
    def strip_vivado(cls, value: object) -> str:
        if not isinstance(value, str):
            return ""
        return value.strip()


def load_tools() -> ToolSettings:
    path = tools_file()
    if not path.is_file():
        return ToolSettings()
    return ToolSettings.model_validate_json(path.read_text(encoding="utf-8"))


def save_tools(settings: ToolSettings) -> ToolSettings:
    path = tools_file()
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(settings.model_dump_json(indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    return settings
