"""Packaged-app paths and the single-instance launch decision."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.health import router as health_router
from app.launcher import HOST, bind_host, classify_health, port_is_free
from app.paths import repo_root
from app.studio_ui import install_frontend


def test_listener_decision_does_not_start_a_second_copy() -> None:
    assert classify_health(None, None) == "free"
    assert classify_health(-1, None) == "unknown"
    assert classify_health(200, {"status": "ok", "service": "hdl-design-studio"}) == "ours"
    assert classify_health(200, {"status": "ok", "service": "other"}) == "other"
    assert classify_health(404, {"status": "ok", "service": "hdl-design-studio"}) == "other"
    assert bind_host() == HOST == "127.0.0.1"


def test_taken_port_is_detected_by_binding() -> None:
    import socket

    held = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    held.bind(("127.0.0.1", 0))
    port = held.getsockname()[1]
    try:
        assert port_is_free(port) is False
    finally:
        held.close()
    assert port_is_free(port) is True


def test_development_workspace_stays_in_the_checkout(monkeypatch) -> None:
    monkeypatch.delenv("HDS_WORKSPACE", raising=False)
    monkeypatch.setattr("app.paths.is_packaged", lambda: False)
    from app.paths import workspace_dir

    assert workspace_dir() == repo_root() / "workspace"


def test_packaged_projects_are_outside_the_install_directory(monkeypatch, tmp_path) -> None:
    monkeypatch.delenv("HDS_WORKSPACE", raising=False)
    monkeypatch.setattr("app.paths.is_packaged", lambda: True)
    monkeypatch.setattr("app.paths.documents_dir", lambda: tmp_path)
    from app.paths import workspace_dir

    assert workspace_dir() == tmp_path / "HDL-Maker" / "Projects"
    assert "workspace" not in workspace_dir().parts[-3:]


def test_workspace_override_wins_for_a_packaged_build(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "custom"))
    monkeypatch.setattr("app.paths.is_packaged", lambda: True)
    from app.paths import workspace_dir

    assert workspace_dir() == tmp_path / "custom"


def test_built_ui_and_api_share_one_origin(monkeypatch) -> None:
    index = repo_root() / "frontend" / "dist" / "index.html"
    if not index.is_file():
        return
    monkeypatch.setenv("HDS_SERVE_UI", "1")
    application = FastAPI()
    application.include_router(health_router, prefix="/api")
    assert install_frontend(application)
    client = TestClient(application)
    page = client.get("/")
    assert page.status_code == 200
    assert "HDL Design Studio" in page.text
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["service"] == "hdl-design-studio"
    assets = page.text.split('src="', 1)[1].split('"', 1)[0]
    assert assets.startswith("/assets/")
    assert client.get(assets).status_code == 200
