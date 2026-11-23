from fastapi.testclient import TestClient

from app.main import app
from app.models.design import ProjectFile

client = TestClient(app)


def test_health_reports_python_and_ghdl_field() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "hdl-design-studio"
    assert body["python"].startswith("3.10.")
    assert "ghdl" in body


def test_empty_project_matches_schema_version() -> None:
    project = ProjectFile(project_id="proj_test", name="empty")
    payload = project.model_dump(mode="json")
    assert payload["schema_version"] == 2
    assert payload["vhdl_standard"] == "93"
    assert payload["library_profile"] == "ieee"
    assert payload["libraries"] == []
    assert payload["design_units"] == []
    assert payload["diagrams"] == []
    loaded = ProjectFile.model_validate(payload)
    assert loaded.name == "empty"


def test_schema_v1_project_loads_and_is_saved_as_v2(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    from app.storage.project_store import load_project, save_project

    loaded = ProjectFile.model_validate(
        {
            "schema_version": 1,
            "project_id": "proj_old",
            "name": "local",
            "libraries": [],
            "design_units": [],
        }
    )
    assert loaded.schema_version == 1
    assert loaded.vhdl_standard == "93"
    assert loaded.library_profile == "ieee"
    assert loaded.diagrams == []
    save_project(loaded)
    stored = load_project()
    assert stored.schema_version == 2
    assert stored.vhdl_standard == "93"
    assert stored.library_profile == "ieee"
    assert stored.project_id == "proj_old"
    assert stored.diagrams == []
