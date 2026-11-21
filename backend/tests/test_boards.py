"""Board catalog read from boardfiles/, without inventing a part number."""

from fastapi.testclient import TestClient

from app.boards import list_boards
from app.main import app
from app.paths import boardfiles_dir

client = TestClient(app)


def test_installed_board_files_keep_their_part_numbers() -> None:
    catalog = list_boards()
    assert catalog.unreadable == []
    by_id = {board.id: board for board in catalog.boards}
    zybo = by_id["zybo/B.4/board.xml"]
    zybo_z7 = by_id["zybo-z7-20/A.0/board.xml"]
    assert zybo.display_name == "Zybo"
    assert zybo.revisions == ["B.4"]
    assert zybo.part_names == ["xc7z010clg400-1"]
    assert zybo_z7.display_name == "Zybo Z7-20"
    assert zybo_z7.part_names == ["xc7z020clg400-1"]
    assert len(by_id) == len(catalog.boards)
    assert len(catalog.boards) == len(list(boardfiles_dir().rglob("board.xml")))


def test_a_folder_with_board_xml_joins_the_catalog(monkeypatch, tmp_path) -> None:
    root = tmp_path / "boardfiles"
    defined = root / "lab" / "A"
    defined.mkdir(parents=True)
    (defined / "board.xml").write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
        <board name="lab-board" display_name="Lab Board" vendor="example.com">
          <file_version>1</file_version>
          <compatible_board_revisions><revision id="0">A</revision></compatible_board_revisions>
          <components>
            <component name="part0" type="fpga" part_name="xc7z010clg400-1"/>
            <component name="clock" type="chip"/>
          </components>
        </board>
        """,
        encoding="utf-8",
    )
    missing_part = root / "bare"
    missing_part.mkdir()
    (missing_part / "board.xml").write_text(
        '<board name="bare" display_name="Bare"><components><component type="fpga"/></components></board>',
        encoding="utf-8",
    )
    broken = root / "broken"
    broken.mkdir()
    (broken / "board.xml").write_text("<board>", encoding="utf-8")
    monkeypatch.setattr("app.boards.boardfiles_dir", lambda: root)
    catalog = list_boards()
    assert [board.id for board in catalog.boards] == ["bare/board.xml", "lab/A/board.xml"]
    bare = catalog.boards[0]
    assert bare.part_names == []
    assert catalog.boards[1].part_names == ["xc7z010clg400-1"]
    assert catalog.unreadable == ["broken/board.xml"]


def test_selected_board_is_restored(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HDS_WORKSPACE", str(tmp_path / "ws"))
    saved = client.put("/api/ui", json={"library_name": "demo", "board_id": "zybo/B.4/board.xml"})
    assert saved.status_code == 200
    assert client.get("/api/ui").json()["board_id"] == "zybo/B.4/board.xml"
    listed = client.get("/api/boards")
    assert listed.status_code == 200
    assert any(board["id"] == "zybo/B.4/board.xml" for board in listed.json()["boards"])
