"""New designs, explicit net decisions, and hierarchy."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.editing.create import add_generic, add_instance, add_interface_port, new_diagram
from app.editing.hierarchy import hierarchy_checks
from app.editing.nets import NetChoiceRequired, connect_ports, merge_nets, split_endpoint
from app.editing.validate import connection_checks
from app.identity import new_id
from app.main import app
from app.models.design import DesignUnit, DiagramGeneric
from app.models.editable import EditableDiagram, EditableInstance, EditablePort
from app.paths import repo_root
from app.storage.diagram_store import load_editable

client = TestClient(app)


def test_different_nets_stay_apart_until_the_caller_merges_them() -> None:
    diagram = new_diagram("board", "lib_test")
    clock = add_interface_port(diagram, "clk", "in", "std_logic")
    reset = add_interface_port(diagram, "rst", "in", "std_logic")
    enable = add_interface_port(diagram, "en", "in", "std_logic")
    locked = add_interface_port(diagram, "locked", "out", "std_logic")
    connect_ports(diagram, _pin(clock), _pin(reset))
    connect_ports(diagram, _pin(enable), _pin(locked))
    diagram.nets[0].type_text = "std_logic"
    diagram.nets[1].type_text = "integer"
    with pytest.raises(NetChoiceRequired):
        connect_ports(diagram, _pin(reset), _pin(enable))
    assert len(diagram.nets) == 2
    assert len(diagram.wires) == 2
    merge_nets(diagram, diagram.nets[0].id, diagram.nets[1].id)
    assert len(diagram.nets) == 1
    assert diagram.nets[0].type_text == "std_logic"
    assert len(diagram.nets[0].endpoints) == 4
    joined = connect_ports(diagram, _pin(reset), _pin(enable))
    assert joined.net_id == diagram.nets[0].id


def test_splitting_an_endpoint_cuts_only_the_crossing_wire() -> None:
    diagram = new_diagram("board", "lib_test")
    clock = add_interface_port(diagram, "clk", "in", "std_logic")
    reset = add_interface_port(diagram, "rst", "in", "std_logic")
    enable = add_interface_port(diagram, "en", "in", "std_logic")
    connect_ports(diagram, _pin(clock), _pin(reset))
    crossing = connect_ports(diagram, _pin(reset), _pin(enable))
    assert len(diagram.nets[0].endpoints) == 3
    fresh = split_endpoint(diagram, crossing.id, "end")
    assert fresh.endpoints[0].owner_id == enable.id
    assert all(wire.id != crossing.id for wire in diagram.wires)
    surviving = next(net for net in diagram.nets if net.id != fresh.id)
    assert {item.owner_id for item in surviving.endpoints} == {clock.id, reset.id}
    assert isinstance(connection_checks(diagram), list)


def test_version_1_document_without_new_fields_still_loads(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    diagram_id = "edg_" + "ab" * 16
    path = tmp_path / "ws" / "diagrams"
    path.mkdir(parents=True)
    (path / f"{diagram_id}.json").write_text(
        """
        {
          "schema_version": 1,
          "id": "%s",
          "name": "legacy",
          "frame": {"origin_x": 0, "origin_y": 0, "scale": 1},
          "provenance": {
            "source_diagram_id": "dg_old",
            "source_path": "hds/old/struct.bd",
            "source_sha256": "%s",
            "library_id": "lib_old"
          },
          "instances": [],
          "nets": [],
          "wires": []
        }
        """
        % (diagram_id, "c" * 64),
        encoding="utf-8",
    )
    loaded = load_editable(diagram_id)
    assert loaded.schema_version == 1
    assert loaded.provenance.origin == "import"
    assert loaded.generics == []
    assert loaded.provenance.source_diagram_id == "dg_old"
    saved = client.put(f"/api/editable-diagrams/{diagram_id}", json=loaded.model_dump(mode="json"))
    assert saved.status_code == 200
    assert saved.json()["schema_version"] == 1


def test_hierarchical_design_persists_without_touching_the_library(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    examples = Path(client.get("/api/examples/path").json()["path"])
    before = {path: path.read_bytes() for path in examples.rglob("*") if path.is_file()}
    library_root = repo_root() / "libs" / "sbus_rtc_lib"
    library_before = None
    sample = library_root / "hds" / "audio_gain" / "struct.bd"
    if sample.is_file():
        library_before = sample.read_bytes()
    scanned = client.post("/api/libraries/scan", json={"path": str(examples), "library_name": "demo"})
    assert scanned.status_code == 200
    project = scanned.json()
    library_id = project["libraries"][-1]["id"]
    counter = DesignUnit.model_validate(
        next(unit for unit in project["design_units"] if unit["kind"] == "entity" and unit["name"] == "counter")
    )

    child = EditableDiagram.model_validate(
        client.post("/api/editable-diagrams", json={"name": "stage", "library_id": library_id}).json()
    )
    assert child.schema_version == 1
    assert child.provenance.origin == "created"
    assert child.provenance.source_diagram_id is None
    add_generic(child, "G_WIDTH", "positive", "4")
    child_clk = add_interface_port(child, "clk", "in", "std_logic")
    add_interface_port(child, "value", "out", "std_logic_vector", "(7 downto 0)")
    narrow = _counter(child, counter, "4")
    wide = _counter(child, counter, "8")
    assert [narrow.name, wide.name] == ["U_0", "U_1"]
    assert narrow.design_unit_id == wide.design_unit_id == counter.id
    assert _generic(narrow, "WIDTH") == "4"
    assert _generic(wide, "WIDTH") == "8"
    connect_ports(child, _pin(child_clk), _port_pin(narrow, "clk"))
    connect_ports(child, _pin(child_clk), _port_pin(wide, "clk"))
    stored_child = _put(child)
    assert len(stored_child.nets[0].endpoints) == 3

    parent = EditableDiagram.model_validate(
        client.post("/api/editable-diagrams", json={"name": "board", "library_id": library_id}).json()
    )
    parent_clk = add_interface_port(parent, "clk", "in", "std_logic")
    nibble = add_interface_port(parent, "high_nibble", "out", "std_logic_vector", "(3 downto 0)")
    assert nibble.width == 4
    assert nibble.width_status == "literal"
    left = _counter(parent, counter, "8")
    right = _counter(parent, counter, "8")
    stage = add_instance(
        parent,
        component_name=stored_child.entity_name,
        component_library="demo",
        design_unit_id=None,
        child_diagram_id=stored_child.id,
        ports=[_copied(port) for port in stored_child.diagram_ports],
        generics=[
            DiagramGeneric(name=item.name, type_text=item.type_text, value="8") for item in stored_child.generics
        ],
    )
    assert [left.name, right.name, stage.name] == ["U_0", "U_1", "U_2"]
    connect_ports(parent, _pin(parent_clk), _port_pin(left, "clk"))
    connect_ports(parent, _pin(parent_clk), _port_pin(right, "clk"))
    connect_ports(parent, _pin(parent_clk), _port_pin(stage, "clk"))
    connect_ports(parent, _port_pin(left, "count"), _pin(nibble), "(7 downto 4)")
    stored_parent = _put(parent)

    reloaded_parent = load_editable(stored_parent.id)
    reloaded_child = load_editable(stored_child.id)
    assert reloaded_parent.id == stored_parent.id
    assert reloaded_child.id == stored_child.id
    assert reloaded_parent.instances[2].child_diagram_id == reloaded_child.id
    assert reloaded_parent.instances[0].id == left.id
    clock_net = next(net for net in reloaded_parent.nets if len(net.endpoints) >= 3)
    assert len(clock_net.endpoints) == 4
    assert any(endpoint.slice_text == "(7 downto 4)" for net in reloaded_parent.nets for endpoint in net.endpoints)
    assert not any(item.code == "width_mismatch" for item in reloaded_parent.checks)
    assert reloaded_parent.schema_version == 1

    cycled = reloaded_child.model_copy(deep=True)
    add_instance(
        cycled,
        component_name=reloaded_parent.name,
        component_library="demo",
        design_unit_id=None,
        child_diagram_id=reloaded_parent.id,
        ports=[],
        generics=[],
    )
    cycled_body = _put(cycled)
    assert any(item.code == "recursive_hierarchy" for item in cycled_body.checks)
    restored = _put(reloaded_child)
    assert not any(item.code == "recursive_hierarchy" for item in restored.checks)
    assert {path: path.read_bytes() for path in before} == before
    if library_before is not None:
        assert sample.read_bytes() == library_before


def test_a_missing_child_is_reported_and_not_invented() -> None:
    diagram = new_diagram("board", "lib_test")
    add_instance(
        diagram,
        component_name="missing",
        component_library=None,
        design_unit_id=None,
        child_diagram_id=new_id("edg"),
        ports=[],
        generics=[],
    )

    def fail_load(_diagram_id: str) -> EditableDiagram:
        from app.storage.diagram_store import DiagramStoreError

        raise DiagramStoreError("diagram_not_found", "missing")

    codes = {item.code for item in hierarchy_checks(diagram, fail_load)}
    assert codes == {"child_missing"}
    assert diagram.instances[0].ports == []


def _put(diagram: EditableDiagram) -> EditableDiagram:
    saved = client.put(f"/api/editable-diagrams/{diagram.id}", json=diagram.model_dump(mode="json"))
    assert saved.status_code == 200, saved.text
    return EditableDiagram.model_validate(saved.json())


def _generic(instance: EditableInstance, name: str) -> str | None:
    return next(item.value for item in instance.generics if item.name == name)


def _counter(diagram: EditableDiagram, unit: DesignUnit, width: str) -> EditableInstance:
    return add_instance(
        diagram,
        component_name=unit.name,
        component_library="demo",
        design_unit_id=unit.id,
        child_diagram_id=None,
        ports=[
            EditablePort(
                id=new_id("dport"),
                name=port.name,
                direction=port.direction,
                type_text=port.type_text,
                range_text=port.range_text,
                width=port.width,
                width_status=port.width_status,
            )
            for port in unit.ports
        ],
        generics=[
            DiagramGeneric(
                name=item.name,
                type_text=item.type_text,
                value=width if item.name == "WIDTH" else item.default_text,
            )
            for item in unit.generics
        ],
    )


def _copied(port) -> EditablePort:
    return EditablePort(
        id=new_id("dport"),
        name=port.name,
        direction=port.direction,
        type_text=port.type_text,
        range_text=port.range_text,
        width=port.width,
        width_status=port.width_status,
    )


def _pin(port) -> tuple[str, str, str]:
    return ("diagram_port", port.id, port.id)


def _port_pin(instance, name: str) -> tuple[str, str, str]:
    port = next(item for item in instance.ports if item.name == name)
    return ("instance", instance.id, port.id)
