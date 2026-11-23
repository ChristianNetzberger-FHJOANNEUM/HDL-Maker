"""Build directories stay put, and a passed build is not a hardware test."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.fpga.artifacts import (
    archive_build,
    list_validations,
    note_sram_programmed,
    reserve_build_directory,
    summarize_build,
    validation_for_build,
)
from app.fpga.session import reset_tool
from app.main import app

client = TestClient(app)


@pytest.fixture()
def workspace(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("HDS_WORKSPACE", str(root))
    reset_tool()
    return root


def test_an_existing_build_directory_is_not_replaced(workspace: Path) -> None:
    directory = workspace / "builds" / "osb_existing"
    directory.mkdir(parents=True)
    (directory / "report.json").write_text("{}\n", encoding="utf-8")
    with pytest.raises(Exception) as caught:
        reserve_build_directory(directory)
    assert "not overwritten" in str(caught.value)
    assert (directory / "report.json").read_text(encoding="utf-8") == "{}\n"
    destination = workspace / "builds" / "kept"
    destination.mkdir()
    (destination / "marker.txt").write_text("stay\n", encoding="utf-8")
    source = workspace / "fresh"
    source.mkdir()
    (source / "marker.txt").write_text("new\n", encoding="utf-8")
    assert archive_build(source, destination) is False
    assert (destination / "marker.txt").read_text(encoding="utf-8") == "stay\n"


def test_a_passed_build_is_not_a_hardware_test(workspace: Path) -> None:
    run = {
        "build_id": "osb_new",
        "toolchain": "opensource",
        "status": "passed",
        "part": "xc7z020clg400-1",
        "vhdl_standard": "93",
        "directory": str(workspace / "builds" / "osb_new"),
        "bitstream_path": None,
        "bitstream_sha256": "ab" * 32,
        "reports": {"nextpnr": {"slice_lutx": 56, "slice_ffx": 27, "carry4": 7, "critical_path_ns": 2.68}},
        "diagnostics": [],
        "started_at": "2026-11-23T15:00:00+00:00",
        "finished_at": "2026-11-23T15:00:12+00:00",
    }
    summary = summarize_build(run)
    assert summary is not None
    assert summary["validation"]["build_passed"] is True
    assert summary["validation"]["jtag_detected"] is None
    assert summary["validation"]["programming_completed"] is None
    assert summary["validation"]["hardware_function_verified"] is None
    assert summary["timing"]["method"] == "nextpnr critical path"
    note_sram_programmed({"mock": True, "programmed": False, "build_id": "osb_new"})
    assert validation_for_build("osb_new", "passed")["programming_completed"] is None


def test_the_programmed_open_source_hash_is_not_the_later_file(workspace: Path) -> None:
    later = workspace / "builds" / "o2a-zybo-counter"
    later.mkdir(parents=True)
    (later / "zybo_counter.bit").write_bytes(b"not-the-programmed-file")
    records = list_validations()
    programmed = next(item for item in records if item["build_id"] == "osb_574eb1ad8c3b4ac8a36b359745d3534d")
    assert programmed["bitstream_sha256"] == "277aa58dfbfe90b207da7c44d648232af4358162a2210c58ed57aece2abad88e"
    assert programmed["hardware_function_verified"] is True
    assert programmed["file_present"] is False
    assert programmed["bitstream_path"] is None
    vivado = next(item for item in records if item["build_id"] == "bld_34d0198b02b84f73b25a8aa305579d5a")
    assert vivado["hardware_function_verified"] is True
    assert vivado["file_present"] is False


def test_vivado_summary_reads_slack_and_not_the_open_source_path(workspace: Path) -> None:
    directory = workspace / "builds" / "bld_sample"
    directory.mkdir(parents=True)
    (directory / "utilization_impl.rpt").write_text(
        "| Slice LUTs              |    1 |     0 |     53200 | <0.01 |\n"
        "| Slice Registers         |   27 |     0 |    106400 |  0.03 |\n"
        "| CARRY4   |    7 |          CarryLogic |\n",
        encoding="utf-8",
    )
    (directory / "timing_impl.rpt").write_text(
        "      5.520        0.000                      0                   27        0.040        0.000\n",
        encoding="utf-8",
    )
    summary = summarize_build(
        {
            "build_id": "bld_sample",
            "toolchain": "vivado",
            "status": "passed",
            "part": "xc7z020clg400-1",
            "vhdl_standard": "93",
            "directory": str(directory),
            "bitstream_path": None,
            "warnings": ["WARNING: [DRC ZPS7-1] PS7 block required"],
            "started_at": "2026-11-23T10:31:20+00:00",
            "finished_at": "2026-11-23T10:33:25+00:00",
        }
    )
    assert summary is not None
    assert summary["resources"]["slice_luts"] == 1
    assert summary["resources"]["slice_registers"] == 27
    assert summary["resources"]["carry4"] == 7
    assert summary["timing"]["wns_ns"] == 5.52
    assert summary["timing"]["whs_ns"] == 0.04
    assert summary["timing"]["method"] == "Vivado slack"
    assert summary["validation"]["hardware_function_verified"] is None
    body = client.get("/api/fpga/comparison").json()
    assert "not the same measurement" in body["timing_note"]
    assert body["validations"]


def test_manifest_keeps_the_build_identity(workspace: Path) -> None:
    from app.fpga.artifacts import attach_bitstream, manifest_fields, write_manifest

    directory = workspace / "builds" / "osb_manifest"
    directory.mkdir(parents=True)
    bitstream = directory / "zybo_counter.bit"
    bitstream.write_bytes(b"bit")
    run = {
        "build_id": "osb_manifest",
        "toolchain": "opensource",
        "part": "xc7z020clg400-1",
        "vhdl_standard": "93",
        "status": "passed",
        "bitstream_path": str(bitstream),
    }
    attach_bitstream(run)
    write_manifest(directory, run)
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    assert manifest_fields(run)["bitstream_sha256"] == manifest["bitstream_sha256"]
    assert manifest["toolchain"] == "opensource"
    assert manifest["vhdl_standard"] == "93"
    assert len(manifest["bitstream_sha256"]) == 64
