"""Local tool paths for this machine.

``workspace/tools.json`` stores the GTKWave executable and Vivado.
``workspace/opensource-tools.json`` stores the open-source FPGA tools.
Neither file is a diagram, ``ui.json``, or part of the VHDL project.
Saving one does not rewrite the other.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator

from app.paths import opensource_tools_file, tools_file


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


class OpenSourceSettings(BaseModel):
    """Paths for the open-source FPGA chain. Empty means the usual lookup, never Vivado."""

    model_config = ConfigDict(extra="ignore")

    ghdl_path: str = ""
    yosys_path: str = ""
    nextpnr_xilinx_path: str = ""
    fasm2frames_path: str = ""
    xc7frames2bit_path: str = ""
    prjxray_db_path: str = ""
    openfpga_loader_path: str = ""

    @field_validator(
        "ghdl_path",
        "yosys_path",
        "nextpnr_xilinx_path",
        "fasm2frames_path",
        "xc7frames2bit_path",
        "prjxray_db_path",
        "openfpga_loader_path",
    )
    @classmethod
    def strip_opensource_path(cls, value: object) -> str:
        if not isinstance(value, str):
            return ""
        return value.strip()


def load_opensource_tools() -> OpenSourceSettings:
    path = opensource_tools_file()
    if not path.is_file():
        return OpenSourceSettings()
    return OpenSourceSettings.model_validate_json(path.read_text(encoding="utf-8"))


def save_opensource_tools(settings: OpenSourceSettings) -> OpenSourceSettings:
    path = opensource_tools_file()
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(settings.model_dump_json(indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    return settings
