"""Hierarchy names come from instantiations, not from declarations."""

from pathlib import Path

from app.importers.vhdl.extract import extract_design_units
from app.importers.vhdl.hierarchy import instantiation_names

_PARENT = """
entity child is
  port (clk : in std_logic);
end entity child;

architecture rtl of parent is
  component child is
    port (clk : in std_logic);
  end component;
  signal clk : std_logic;
begin
  u_decl_only : child port map (clk => clk);
  u_direct : entity work.child(rtl) port map (clk => clk);
  u_again : child port map (clk => clk);
  u_ext : entity other_lib.foreign port map (clk => clk);
  for all : child use entity work.child(rtl);
end architecture rtl;
"""


def test_instantiations_ignore_declarations_and_keep_external_names() -> None:
    assert instantiation_names(_PARENT) == ["child", "other_lib.foreign"]
    units = extract_design_units("entity parent is end entity parent;\n" + _PARENT)
    architecture = next(unit for unit in units if unit.kind == "architecture")
    assert architecture.instantiates == ["child", "other_lib.foreign"]
    assert architecture.parent_name == "parent"


def test_library_structural_vhdl_lists_its_components() -> None:
    path = Path(__file__).resolve().parents[2] / "libs" / "sbus_rtc_lib" / "hdl" / "top_rtc_app_struct.vhd"
    if not path.is_file():
        return
    units = extract_design_units(path.read_text(encoding="utf-8", errors="replace"))
    architecture = next(unit for unit in units if unit.kind == "architecture" and unit.parent_name == "top_rtc_app")
    names = [name.lower() for name in architecture.instantiates]
    assert "audio_dsp" in names
    assert "audio_gain" in names
    assert all(" " not in name for name in names)
