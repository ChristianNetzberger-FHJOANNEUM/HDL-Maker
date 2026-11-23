import json
from pathlib import Path

from app.editing.convert import editable_from_import
from app.identity import new_id, rebind
from app.importers.hds.extract import extract_graphical
from app.importers.hds.grammar import parse_document
from app.importers.hds.vhdl_check import check_against_vhdl
from app.importers.inventory import import_library, scan_directory
from app.models.design import Library, ProjectFile
from app.paths import repo_root
from tests.fixtures.hds_samples import MIN_BD, MIN_SB, MIN_SM, STRUCT_VHDL


def _diagram(text: str, relative: str = "hds/sample/struct.bd"):
    return extract_graphical(text, relative=relative, file_hash="a" * 64, library_id="lib_test")


def test_block_diagram_extracts_instance_port_and_wire() -> None:
    diagram = _diagram(MIN_BD)
    assert diagram.view == "block"
    assert diagram.entity_name == "audio_gain"
    assert diagram.architecture_name == "struct"
    assert diagram.parse_status == "partial"
    assert diagram.preserved_records[0].type_name == "FutureWidget"
    payload = json.loads(diagram.preserved_records[0].payload)
    assert payload["fields"][0]["value"] == "kept"
    instance = diagram.instances[0]
    assert instance.name == "U_0"
    assert instance.component_name == "comp_barrelshifter"
    assert instance.component_library == "sbus_rtc_lib"
    assert instance.hds_uid == "994,0"
    assert (instance.x1, instance.y1, instance.x2, instance.y2) == (-41000, 46000, -22000, 52000)
    assert instance.generics[0].name == "nbits_g"
    assert instance.generics[0].value == "24"
    assert [port.name for port in instance.ports] == ["sig_i", "enable_o"]
    assert instance.ports[0].direction is None
    assert instance.ports[1].marker_m == 1
    assert diagram.ports[0].name == "audio_in_left_i"
    assert diagram.ports[0].direction == "in"
    wire = diagram.wires[0]
    assert wire.start_object == 2
    assert wire.end_object == 46
    assert wire.net_object == 77
    assert [(point.x, point.y) for point in wire.points] == [(-54000, 47000), (-41750, 47000)]
    assert wire.slice_text == "(7 downto 0)"
    assert wire.label is None
    assert diagram.nets[0].name == "audio_in_left_i"
    assert diagram.embedded_blocks[0].name == "mux"
    assert diagram.embedded_blocks[0].text == "sig_i <= audio_in_left_i;"


def test_wire_label_keeps_its_rectangle_and_points() -> None:
    text = MIN_BD.replace(
        'on &77\nsl "(7 downto 0)"\n)',
        'tg (WTG\n'
        'f (Text\n'
        'va (VaSet\n'
        'font "arial,8,0"\n'
        ')\n'
        'xt "-52000,46000,-48000,47000"\n'
        'st "audio_in_left_i"\n'
        'blo "-52000,46800"\n'
        'tm "WireNameMgr"\n'
        ')\n'
        ')\n'
        'on &77\n'
        'sl "(7 downto 0)"\n'
        ')',
    )
    wire = _diagram(text).wires[0]
    assert [(point.x, point.y) for point in wire.points] == [(-54000, 47000), (-41750, 47000)]
    assert wire.label is not None
    assert wire.label.hidden is False
    assert wire.label.text == "audio_in_left_i"
    assert (wire.label.x1, wire.label.y1, wire.label.x2, wire.label.y2) == (-52000, 46000, -48000, 47000)
    copied = editable_from_import(_diagram(text), [])
    copied_wire = copied.wires[0]
    assert [(point.x, point.y) for point in copied_wire.points] == [(-54000, 47000), (-41750, 47000)]
    assert (copied_wire.label_x, copied_wire.label_y, copied_wire.label_width, copied_wire.label_height) == (
        -52000,
        47000,
        4000,
        1000,
    )
    assert copied_wire.label_hidden is False


def test_hidden_wire_label_stays_hidden() -> None:
    text = MIN_BD.replace(
        'on &77\nsl "(7 downto 0)"\n)',
        'tg (WTG\n'
        'f (Text\n'
        'va (VaSet\n'
        'isHidden 1\n'
        'font "arial,8,0"\n'
        ')\n'
        'xt "-52000,46000,-48000,47000"\n'
        'st "audio_in_left_i"\n'
        'tm "WireNameMgr"\n'
        ')\n'
        ')\n'
        'on &77\n'
        'sl "(7 downto 0)"\n'
        ')',
    )
    wire = _diagram(text).wires[0]
    assert wire.label is not None and wire.label.hidden is True
    assert [(point.x, point.y) for point in wire.points] == [(-54000, 47000), (-41750, 47000)]


def test_symbol_and_state_views() -> None:
    symbol = _diagram(MIN_SB, "hds/sample/symbol.sb")
    assert symbol.view == "symbol"
    assert symbol.ports[0].name == "audio_in_scale"
    assert symbol.ports[0].x1 == 14250
    state = _diagram(MIN_SM, "hds/sample/fsm.sm")
    assert state.view == "state"
    assert state.machine_name == "csm"
    assert state.state_signal_name == "current_state"
    assert state.entity_name == "audio_fifo_ctrl"
    assert state.instances == []
    assert state.states == []
    assert state.transitions == []
    assert any(item.code == "state_prototype_not_placed" for item in state.diagnostics)
    assert state.record_counts["State"] == 1


def test_syntax_error_is_reported() -> None:
    diagram = _diagram('model (BlockDiag\n')
    assert diagram.parse_status == "unsupported"
    assert diagram.diagnostics[0].code == "hds_syntax"


def test_vhdl_check_reports_open_and_does_not_invent(tmp_path: Path) -> None:
    (tmp_path / "hdl").mkdir()
    (tmp_path / "hdl" / "audio_gain_struct.vhd").write_text(STRUCT_VHDL, encoding="utf-8")
    diagram = _diagram(MIN_BD)
    findings = {item.code: item for item in check_against_vhdl(diagram, tmp_path)}
    assert findings["vhdl_struct_matches"].severity == "info"
    assert "port_net_differs" not in findings
    assert "component_name_differs" not in findings


def test_scan_recognizes_graphical_files_without_modifying_them(tmp_path: Path) -> None:
    library = tmp_path / "lib"
    (library / "hds").mkdir(parents=True)
    (library / "hdl").mkdir()
    source = library / "hds" / "struct.bd"
    source.write_text(MIN_BD, encoding="utf-8")
    original = source.read_bytes()
    (library / "hds" / "_sample._epf").write_text(
        "DEFAULT_FILE atom sample/struct.bd\nDEFAULT_ARCHITECTURE atom struct\nEXTRA line\n",
        encoding="utf-8",
    )
    (library / ".hdlsidedata").mkdir()
    (library / ".hdlsidedata" / "cache.xrf").write_text("hidden", encoding="utf-8")
    (library / "hdl" / "audio_gain_struct.vhd").write_text(STRUCT_VHDL, encoding="utf-8")
    scanned, _units, diagrams = scan_directory(str(library), "work")
    assert source.read_bytes() == original
    report = scanned.last_import
    assert report is not None
    assert report.counts["block_diagrams"] == 1
    assert report.counts["symbols"] == 0
    assert report.counts["state_diagrams"] == 0
    assert report.counts["view_references"] == 1
    assert report.counts["interface_diagrams"] == 0
    assert report.view_references[0].default_file == "sample/struct.bd"
    assert report.view_references[0].default_architecture == "struct"
    assert any(item.code == "view_reference_unrecognized" for item in report.diagnostics)
    assert not any("hdlsidedata" in entry.path for entry in report.files)
    assert diagrams[0].instances[0].name == "U_0"
    assert any(item.code == "vhdl_struct_matches" for item in diagrams[0].vhdl_check)

    with_side, _units, _diagrams = scan_directory(str(library), "work", include_side_data=True)
    side_report = with_side.last_import
    assert side_report is not None
    assert any(entry.path == ".hdlsidedata/cache.xrf" for entry in side_report.files)
    assert any(item.code == "side_data_listed" for item in side_report.diagnostics)
    assert source.read_bytes() == original


def test_reimport_and_relocation_keep_ids(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    library = tmp_path / "lib"
    library.mkdir()
    (library / "e.vhd").write_text(
        "entity audio_gain is port (clk : in std_logic); end entity audio_gain;\n",
        encoding="utf-8",
    )
    (library / "struct.bd").write_text(MIN_BD, encoding="utf-8")
    first = import_library(str(library), "work")
    second = import_library(str(library), "work")
    assert [unit.id for unit in first.design_units] == [unit.id for unit in second.design_units]
    assert first.design_units[0].ports[0].id == second.design_units[0].ports[0].id
    assert [item.id for item in first.diagrams] == [item.id for item in second.diagrams]
    assert first.diagrams[0].instances[0].id == second.diagrams[0].instances[0].id

    moved = tmp_path / "moved"
    moved.mkdir()
    (moved / "e.vhd").write_text((library / "e.vhd").read_text(encoding="utf-8"), encoding="utf-8")
    (moved / "struct.bd").write_text(MIN_BD, encoding="utf-8")
    third = import_library(str(moved), "work")
    assert third.libraries[0].id == first.libraries[0].id
    assert third.design_units[0].id == first.design_units[0].id
    assert third.diagrams[0].id == first.diagrams[0].id
    assert third.diagrams[0].instances[0].id == first.diagrams[0].instances[0].id
    assert any(item.code == "library_relocated" for item in third.libraries[0].last_import.diagnostics)
    assert len(third.libraries) == 1


def test_ambiguous_library_names_are_not_merged() -> None:
    project = ProjectFile(project_id="proj_test", name="local")
    project.libraries = [
        Library(id="lib_a", name="work", root_path="A", imported_at="2026-01-01T00:00:00Z", updated_at="2026-01-01T00:00:00Z"),
        Library(id="lib_b", name="work", root_path="B", imported_at="2026-01-01T00:00:00Z", updated_at="2026-01-01T00:00:00Z"),
    ]
    fresh = Library(
        id=new_id("lib"),
        name="work",
        root_path="C",
        imported_at="2026-01-02T00:00:00Z",
        updated_at="2026-01-02T00:00:00Z",
    )
    from app.models.design import ImportReport

    fresh.last_import = ImportReport(
        library_id=fresh.id,
        library_name="work",
        root_path="C",
        scanned_at="2026-01-02T00:00:00Z",
        files=[],
        unit_ids=[],
        counts={},
        diagnostics=[],
    )
    original = fresh.id
    rebind(project, fresh, [], [])
    assert fresh.id == original
    assert any(item.code == "library_identity_ambiguous" for item in fresh.last_import.diagnostics)


def test_real_audio_gain_when_present() -> None:
    path = repo_root() / "libs" / "sbus_rtc_lib" / "hds" / "audio_gain" / "struct.bd"
    if not path.is_file():
        return
    text = path.read_bytes()
    try:
        decoded = text.decode("utf-8")
    except UnicodeDecodeError:
        decoded = text.decode("latin-1")
    before = path.read_bytes()
    document = parse_document(decoded)
    assert document.objects
    diagram = extract_graphical(
        decoded,
        relative="hds/audio_gain/struct.bd",
        file_hash="b" * 64,
        library_id="lib_real",
    )
    assert path.read_bytes() == before
    names = {instance.name: instance for instance in diagram.instances}
    assert names["U_0"].component_name == "comp_barrelshifter"
    assert names["U_1"].component_name == "comp_barrelshifter"
    assert names["U_0"].generics[0].value == "24"
    assert {block.name for block in diagram.embedded_blocks} >= {"mux", "eb1", "eb2"}
    assert any(block.text and "audio_out_right_tmp" in block.text for block in diagram.embedded_blocks)
    assert diagram.preserved_records == []
    assert any(wire.start_object and wire.end_object and wire.net_object for wire in diagram.wires)
