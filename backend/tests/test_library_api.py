from fastapi.testclient import TestClient

from app.importers.__main__ import main
from app.main import app

client = TestClient(app)


def test_scan_examples_and_read_source(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    examples = client.get("/api/examples/path")
    assert examples.status_code == 200
    scanned = client.post("/api/libraries/scan", json={"path": examples.json()["path"], "library_name": "demo"})
    assert scanned.status_code == 200
    project = scanned.json()
    assert len(project["libraries"]) == 1
    counter = next(unit for unit in project["design_units"] if unit["name"] == "counter" and unit["kind"] == "entity")
    source = client.get(f"/api/design-units/{counter['id']}/source")
    assert source.status_code == 200
    body = source.json()
    assert "entity counter is" in body["text"]
    assert body["truncated"] is False
    assert body["start_line"] >= 1


def test_missing_directory_is_a_structured_error(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    response = client.post("/api/libraries/scan", json={"path": str(tmp_path / "missing")})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "path_not_found"


def test_second_scan_does_not_duplicate_units(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    library_dir = tmp_path / "lib"
    library_dir.mkdir()
    (library_dir / "e.vhd").write_text(
        "entity only_one is port (clk : in std_logic); end entity only_one;\n",
        encoding="utf-8",
    )
    payload = {"path": str(library_dir), "library_name": "work"}
    first = client.post("/api/libraries/scan", json=payload)
    second = client.post("/api/libraries/scan", json=payload)
    assert first.status_code == 200
    assert len(second.json()["design_units"]) == len(first.json()["design_units"]) == 1
    assert second.json()["design_units"][0]["id"] == first.json()["design_units"][0]["id"]


def test_cli_reports_without_saving(tmp_path, monkeypatch, capsys) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    library_dir = tmp_path / "lib"
    library_dir.mkdir()
    (library_dir / "e.vhd").write_text(
        "entity cli_ent is port (clk : in std_logic); end entity cli_ent;\n",
        encoding="utf-8",
    )
    report_path = tmp_path / "report.json"
    assert main([str(library_dir), "--library", "demo", "--no-save", "--out", str(report_path)]) == 0
    assert "entities 1" in capsys.readouterr().out
    assert report_path.exists()
    assert not (tmp_path / "ws" / "project.json").exists()


def test_cli_rejects_an_unknown_path(tmp_path, capsys) -> None:
    assert main([str(tmp_path / "nope")]) == 2
    assert "path_not_found" in capsys.readouterr().err
