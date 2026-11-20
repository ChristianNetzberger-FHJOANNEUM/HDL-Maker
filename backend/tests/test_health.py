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
    assert payload["schema_version"] == 1
    assert payload["libraries"] == []
    assert payload["design_units"] == []
    loaded = ProjectFile.model_validate(payload)
    assert loaded.name == "empty"
