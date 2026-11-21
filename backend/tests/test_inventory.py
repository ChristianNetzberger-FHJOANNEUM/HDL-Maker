import hashlib

from app.importers.inventory import import_library, scan_directory
from app.paths import examples_dir


def test_examples_library_inventory() -> None:
    library, units, _diagrams = scan_directory(str(examples_dir()), "demo")
    assert library.name == "demo"
    by_name = {(unit.kind, unit.name): unit for unit in units}

    counter = by_name[("entity", "counter")]
    assert [port.name for port in counter.ports] == ["clk", "rst", "en", "count"]
    assert counter.ports[3].width == 8
    assert "library:ieee" in counter.dependencies
    assert "use:ieee.numeric_std" in counter.dependencies

    comparator = by_name[("entity", "comparator")]
    assert comparator.ports[0].width_status == "unresolved"
    assert comparator.ports[0].width is None

    controller = by_name[("entity", "controller")]
    assert [port.name for port in controller.ports] == ["clk", "rst", "equal", "enable", "done"]
    architectures = {(unit.parent_name, unit.name) for unit in units if unit.kind == "architecture"}
    assert architectures == {
        ("counter", "rtl"),
        ("counter", "behavioral"),
        ("comparator", "rtl"),
        ("controller", "fsm"),
    }
    assert ("package", "utils_pkg") in by_name
    assert ("package_body", "utils_pkg") in by_name

    report = library.last_import
    assert report is not None
    roles = {entry.path: entry.role for entry in report.files}
    assert roles["metadata/sample.hds"] == "metadata_candidate"
    assert roles["systemverilog/alu.sv"] == "systemverilog"
    assert roles["notes/readme.txt"] == "unrecognized"
    assert any(item.code == "metadata_not_interpreted" for item in report.diagnostics)
    assert any(item.code == "systemverilog_deferred" for item in report.diagnostics)
    assert not any(unit.language == "systemverilog" for unit in units)
    assert report.counts["entities"] == 3


def test_rescan_keeps_ids_and_does_not_duplicate(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    library_dir = tmp_path / "lib"
    library_dir.mkdir()
    source = library_dir / "counter.vhd"
    source.write_text(
        "entity counter is port (clk : in std_logic); end entity counter;\n",
        encoding="utf-8",
    )
    original = source.read_bytes()
    first = import_library(str(library_dir), "work")
    second = import_library(str(library_dir), "work")
    assert source.read_bytes() == original
    assert len(second.libraries) == 1
    assert [unit.id for unit in first.design_units] == [unit.id for unit in second.design_units]
    assert second.libraries[0].imported_at == first.libraries[0].imported_at
    assert hashlib.sha256(original).hexdigest() == second.design_units[0].source.sha256


def test_duplicate_entity_names_are_both_kept(tmp_path) -> None:
    library_dir = tmp_path / "lib"
    (library_dir / "a").mkdir(parents=True)
    (library_dir / "b").mkdir()
    text = "entity alu is port (y : out std_logic); end entity alu;\n"
    (library_dir / "a" / "alu.vhd").write_text(text, encoding="utf-8")
    (library_dir / "b" / "alu.vhd").write_text(text, encoding="utf-8")
    _library, units, _diagrams = scan_directory(str(library_dir), "work")
    entities = [unit for unit in units if unit.kind == "entity"]
    assert len(entities) == 2
    assert len({unit.id for unit in entities}) == 2
    assert all(any(item.code == "duplicate_unit_name" for item in unit.diagnostics) for unit in entities)


def test_missing_architecture_entity_is_not_invented(tmp_path) -> None:
    library_dir = tmp_path / "lib"
    library_dir.mkdir()
    (library_dir / "only_arch.vhd").write_text(
        "architecture rtl of missing is begin end architecture rtl;\n",
        encoding="utf-8",
    )
    _library, units, _diagrams = scan_directory(str(library_dir), "work")
    assert [unit.kind for unit in units] == ["architecture"]
    assert units[0].parent_name == "missing"
    assert any(item.code == "architecture_entity_missing" for item in units[0].diagnostics)


def test_oversized_and_binary_files_are_listed(tmp_path) -> None:
    library_dir = tmp_path / "lib"
    library_dir.mkdir()
    (library_dir / "big.vhd").write_text("entity big is end entity big;\n", encoding="utf-8")
    (library_dir / "blob.hds").write_bytes(b"HDS\x00bin")
    library, units, _diagrams = scan_directory(str(library_dir), "work", max_bytes=12)
    assert units == []
    report = library.last_import
    assert report is not None
    assert {entry.path for entry in report.files} == {"big.vhd", "blob.hds"}
    blob = next(entry for entry in report.files if entry.path == "blob.hds")
    assert blob.binary is True
    assert any(item.code == "file_too_large" for item in report.diagnostics)
    assert any(item.code == "metadata_not_interpreted" for item in report.diagnostics)


def test_relative_path_is_resolved_from_the_repository() -> None:
    library, units, _diagrams = scan_directory("examples", "demo")
    assert library.root_path.endswith("examples")
    assert any(unit.name == "counter" for unit in units)
