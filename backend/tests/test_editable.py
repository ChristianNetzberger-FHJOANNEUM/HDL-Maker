from pathlib import Path

from fastapi.testclient import TestClient

from app.editing.convert import editable_from_import
from app.editing.geometry import translate_owner
from app.editing.validate import connection_checks
from app.importers.hds.extract import extract_graphical
from app.importers.hds.vhdl_check import check_against_vhdl
from app.main import app
from app.models.design import DesignUnit, Port, SourceSpan
from app.paths import repo_root
from app.storage.diagram_store import load_editable
from tests.fixtures.hds_samples import MIN_BD

client = TestClient(app)


def _imported():
    return extract_graphical(MIN_BD, relative="hds/sample/struct.bd", file_hash="c" * 64, library_id="lib_test")


def _unit() -> DesignUnit:
    return DesignUnit(
        id="du_barrel",
        library_id="lib_test",
        kind="entity",
        name="comp_barrelshifter",
        language="vhdl",
        source=SourceSpan(path="hdl/comp_barrelshifter.vhd", sha256="d" * 64, start_line=1, end_line=4),
        parse_status="parsed",
        ports=[
            Port(
                id="port_sig",
                name="sig_i",
                direction="in",
                type_text="std_logic_vector",
                range_text="(nbits_g-1 downto 0)",
                width=None,
                width_status="unresolved",
            ),
            Port(
                id="port_en",
                name="enable_o",
                direction="out",
                type_text="std_logic",
                range_text=None,
                width=1,
                width_status="scalar",
            ),
        ],
    )


def test_conversion_keeps_text_slice_and_separate_net() -> None:
    editable = editable_from_import(_imported(), [_unit()])
    block = editable.embedded_blocks[0]
    assert block.name == "mux"
    assert block.text == "sig_i <= audio_in_left_i;"
    assert editable.preserved_records[0].type_name == "FutureWidget"
    wire = editable.wires[0]
    assert wire.slice_text == "(7 downto 0)"
    assert wire.net_id == editable.nets[0].id
    sliced = [item for item in editable.nets[0].endpoints if item.slice_text]
    assert len(sliced) == 1
    assert sliced[0].kind == "diagram_port"
    instance = editable.instances[0]
    assert instance.design_unit_id == "du_barrel"
    assert instance.ports[0].direction == "in"
    assert instance.ports[0].width_status == "unresolved"
    assert instance.ports[1].direction == "out"
    assert any(item.code == "width_unresolved" for item in editable.checks)


def test_moving_an_instance_keeps_the_other_end_and_the_net() -> None:
    editable = editable_from_import(_imported(), [])
    instance = editable.instances[0]
    wire = editable.wires[0]
    net_id = wire.net_id
    far = (wire.points[0].x, wire.points[0].y)
    translate_owner(editable, instance.id, 1000, 500)
    assert wire.net_id == net_id
    assert (wire.points[0].x, wire.points[0].y) == far
    assert [(point.x, point.y) for point in wire.points] == [(-54000, 47000), (-54000, 47500), (-40750, 47500)]
    assert instance.x == -41000 + 1000
    assert instance.y == 52000 + 500


def test_two_drivers_are_reported_and_widths_are_not_invented() -> None:
    editable = editable_from_import(_imported(), [])
    for port in editable.diagram_ports:
        port.direction = "out"
    for port in editable.instances[0].ports:
        if port.name == "sig_i":
            port.direction = "out"
    codes = {item.code for item in connection_checks(editable)}
    assert "multiple_drivers" in codes
    assert "width_unresolved" in codes
    assert all(item.message for item in connection_checks(editable))


def test_save_reopen_and_second_copy_keep_ids(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    library = tmp_path / "lib"
    (library / "hds").mkdir(parents=True)
    source = library / "hds" / "struct.bd"
    source.write_text(MIN_BD, encoding="utf-8")
    before = source.read_bytes()
    scanned = client.post("/api/libraries/scan", json={"path": str(library), "library_name": "work"})
    assert scanned.status_code == 200
    source_id = scanned.json()["diagrams"][0]["id"]
    created = client.post(f"/api/editable-diagrams/from-import/{source_id}")
    assert created.status_code == 200
    body = created.json()
    again = client.post(f"/api/editable-diagrams/from-import/{source_id}")
    assert again.json()["id"] == body["id"]
    assert again.json()["instances"][0]["id"] == body["instances"][0]["id"]
    body["instances"][0]["name"] = "U_moved"
    saved = client.put(f"/api/editable-diagrams/{body['id']}", json=body)
    assert saved.status_code == 200
    loaded = load_editable(body["id"])
    assert loaded.instances[0].name == "U_moved"
    assert loaded.instances[0].id == body["instances"][0]["id"]
    assert loaded.embedded_blocks[0].text == "sig_i <= audio_in_left_i;"
    assert source.read_bytes() == before


def test_real_slices_and_hdl_text_when_present() -> None:
    root = repo_root() / "libs" / "sbus_rtc_lib"
    fxgen = root / "hds" / "fxgen" / "struct.bd"
    audio = root / "hds" / "audio_gain" / "struct.bd"
    top = root / "hds" / "top_rtc_app" / "struct.bd"
    if not fxgen.is_file():
        return
    before = {path: path.read_bytes() for path in (fxgen, audio, top)}
    fx = extract_graphical(fxgen.read_text(encoding="latin-1"), relative="hds/fxgen/struct.bd", file_hash="e" * 64, library_id="lib_real")
    assert any(wire.slice_text == "(31 downto 22)" for wire in fx.wires)
    findings = check_against_vhdl(fx, root)
    assert not any("ramp(31 downto 22)" in item.message for item in findings)
    gain = extract_graphical(audio.read_text(encoding="latin-1"), relative="hds/audio_gain/struct.bd", file_hash="f" * 64, library_id="lib_real")
    copied = editable_from_import(gain, [])
    assert any("audio_out_left_tmp" in block.text for block in copied.embedded_blocks)
    assert copied.provenance.source_diagram_id == gain.id
    if top.is_file():
        app = extract_graphical(top.read_text(encoding="latin-1"), relative="hds/top_rtc_app/struct.bd", file_hash="a" * 64, library_id="lib_real")
        assert any("scl1_internal" in item.message for item in check_against_vhdl(app, root))
    assert {path: path.read_bytes() for path in before} == before
