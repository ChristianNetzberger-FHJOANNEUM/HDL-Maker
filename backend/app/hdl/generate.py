"""Write structural VHDL for the project language standard.

Files go under the workspace generated directory. Source files and libs/ are
not opened for writing. GHDL is used only when it is already on PATH.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from typing import Literal

from pydantic import Field

from app.hdl.analyze import Loader, analyze
from app.hdl.ghdl_run import LibraryProfile, ghdl_prefix
from app.hdl.vhdl import VhdlStandard, render_vhdl
from app.models.design import APIModel, Diagnostic
from app.models.editable import EditableDiagram
from app.paths import generated_vhdl_dir, workspace_dir

GhdlStatus = Literal["not_run", "passed", "failed"]


class GeneratedFile(APIModel):
    entity_name: str
    library_name: str
    relative_path: str
    text: str


class GenerateResult(APIModel):
    vhdl_standard: VhdlStandard
    library_profile: LibraryProfile = "ieee"
    root_diagram_id: str
    output_dir: str
    files: list[GeneratedFile] = Field(default_factory=list)
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    ghdl: GhdlStatus = "not_run"
    ghdl_analysis: GhdlStatus = "not_run"
    ghdl_elaboration: GhdlStatus = "not_run"
    manifest_path: str | None = None


def generate_structural(
    root: EditableDiagram,
    standard: VhdlStandard,
    load: Loader,
    profile: LibraryProfile = "ieee",
) -> GenerateResult:
    output = generated_vhdl_dir(standard)
    designs, diagnostics = analyze(root, standard, load)
    result = GenerateResult(
        vhdl_standard=standard,
        library_profile=profile,
        root_diagram_id=root.id,
        output_dir=str(output),
        diagnostics=diagnostics,
    )
    if any(item.severity == "error" for item in diagnostics) or not designs:
        if not designs and not any(item.severity == "error" for item in diagnostics):
            diagnostics.append(
                Diagnostic(
                    severity="error",
                    code="nothing_to_generate",
                    message="The design produced no VHDL unit.",
                    path=root.id,
                )
            )
            result.diagnostics = diagnostics
        return result
    _require_workspace(output)
    output.mkdir(parents=True, exist_ok=True)
    files: list[GeneratedFile] = []
    for design in designs:
        text = render_vhdl(design, standard)
        relative = f"{design.entity_name}.vhd"
        _write(output / relative, text)
        files.append(
            GeneratedFile(
                entity_name=design.entity_name,
                library_name="work",
                relative_path=relative,
                text=text,
            )
        )
    ghdl, analysis, elaboration, ghdl_detail = _analyze_with_ghdl(
        output,
        [item.relative_path for item in files],
        designs[-1].entity_name if designs else "",
        standard,
        profile,
    )
    if ghdl == "failed":
        step = "analysis" if analysis == "failed" else "elaboration"
        note = (
            "Relaxed compatibility modes were not used."
            if profile == "ieee"
            else "The Synopsys legacy profile was used (-fsynopsys -fexplicit)."
        )
        diagnostics.append(
            Diagnostic(
                severity="error",
                code="ghdl_failed",
                message=ghdl_detail or f"GHDL {step} failed. {note}",
                path=root.id,
            )
        )
    manifest = {
        "files": [
            {"entity_name": item.entity_name, "library_name": item.library_name, "relative_path": item.relative_path}
            for item in files
        ],
        "ghdl": ghdl,
        "ghdl_analysis": analysis,
        "ghdl_elaboration": elaboration,
        "root_diagram_id": root.id,
        "library_profile": profile,
        "root_entity": designs[-1].entity_name if designs else None,
        "vhdl_standard": standard,
    }
    manifest_path = output / "manifest.json"
    _write(manifest_path, json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    result.files = files
    result.diagnostics = diagnostics
    result.ghdl = ghdl
    result.ghdl_analysis = analysis
    result.ghdl_elaboration = elaboration
    result.manifest_path = str(manifest_path)
    return result


def _analyze_with_ghdl(
    output,
    relative_paths: list[str],
    top: str,
    standard: VhdlStandard,
    profile: LibraryProfile,
) -> tuple[GhdlStatus, GhdlStatus, GhdlStatus, str | None]:
    if not relative_paths or not top:
        return "not_run", "not_run", "not_run", None
    executable = shutil.which("ghdl")
    if executable is None:
        return "not_run", "not_run", "not_run", None
    prefix = ghdl_prefix(standard, profile)
    workdir = f"--workdir={output}"
    for relative in relative_paths:
        failed = _run_ghdl(executable, ["-a", *prefix, workdir, relative], output)
        if failed is not None:
            return "failed", "failed", "not_run", f"GHDL analysis failed.\n{failed}"
    failed = _run_ghdl(executable, ["-e", *prefix, workdir, top], output)
    if failed is not None:
        return "failed", "passed", "failed", f"GHDL elaboration failed.\n{failed}"
    return "passed", "passed", "passed", None


def _run_ghdl(executable: str, args: list[str], output) -> str | None:
    try:
        completed = subprocess.run(
            [executable, *args],
            cwd=output,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return str(exc)
    if completed.returncode == 0:
        return None
    detail = (completed.stderr or completed.stdout or "GHDL failed.").strip()
    return detail[:2000]


def _require_workspace(path) -> None:
    root = workspace_dir().resolve()
    if path.resolve() != root and root not in path.resolve().parents:
        raise RuntimeError("Refusing to write generated VHDL outside the workspace.")


def _write(path, text: str) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(text, encoding="utf-8", newline="\n")
    temporary.replace(path)
