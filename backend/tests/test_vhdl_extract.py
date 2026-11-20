from app.importers.vhdl.extract import extract_design_units


def _unit(text: str, name: str):
    matches = [unit for unit in extract_design_units(text) if unit.name.lower() == name.lower()]
    assert matches, [unit.name for unit in extract_design_units(text)]
    return matches[0]


def test_entity_ports_and_literal_width() -> None:
    unit = _unit(
        """
        entity counter is
          generic (WIDTH : positive := 8);
          port (
            clk, rst : in std_logic;
            count : out std_logic_vector(7 downto 0) := (others => '0')
          );
        end entity counter;
        """,
        "counter",
    )
    assert unit.parse_status == "parsed"
    assert [item.name for item in unit.generics] == ["WIDTH"]
    assert unit.generics[0].type_text == "positive"
    assert unit.generics[0].default_text == "8"
    assert [(port.name, port.direction, port.width, port.width_status) for port in unit.ports] == [
        ("clk", "in", 1, "scalar"),
        ("rst", "in", 1, "scalar"),
        ("count", "out", 8, "literal"),
    ]
    assert unit.ports[2].range_text == "7 downto 0"
    assert unit.ports[2].default_text == "(others => '0')"


def test_generic_width_is_not_inferred() -> None:
    unit = _unit(
        """
        entity comparator is
          port (a : in std_logic_vector(WIDTH - 1 downto 0));
        end entity comparator;
        """,
        "comparator",
    )
    assert unit.ports[0].width is None
    assert unit.ports[0].width_status == "unresolved"
    assert any(item.code == "width_unresolved" for item in unit.diagnostics)


def test_missing_mode_is_kept_without_guessing() -> None:
    unit = _unit(
        """
        entity bare is
          port (clk : std_logic);
        end entity bare;
        """,
        "bare",
    )
    assert unit.ports[0].direction is None
    assert any(item.code == "missing_port_mode" for item in unit.diagnostics)


def test_unparsed_item_is_reported_and_not_invented() -> None:
    unit = _unit(
        """
        entity broken is
          port (
            clk : in std_logic;
            this is not an interface
          );
        end entity broken;
        """,
        "broken",
    )
    assert unit.parse_status == "partial"
    assert [port.name for port in unit.ports] == ["clk"]
    failed = [item for item in unit.diagnostics if item.code == "unparsed_interface_item"]
    assert failed
    assert "this is not an interface" in failed[0].message


def test_comments_and_strings_do_not_create_units() -> None:
    units = extract_design_units(
        """
        -- entity ghost is
        entity real_one is
          port (msg : in string := "entity fake is");
        end entity real_one;
        """
    )
    assert [unit.name for unit in units] == ["real_one"]
    assert units[0].ports[0].width_status == "not_applicable"
    assert units[0].ports[0].default_text == '"entity fake is"'


def test_component_and_generate_do_not_hide_the_next_entity() -> None:
    units = extract_design_units(
        """
        entity first is
          port (clk : in std_logic);
        end entity first;

        architecture rtl of first is
          component ghost is
            port (x : in std_logic);
          end component;
        begin
          gen_label : if true generate
            inner : if false generate
            end generate;
          end generate;
        end architecture rtl;

        entity second is
          port (q : out std_logic);
        end entity second;
        """
    )
    assert [(unit.kind, unit.name) for unit in units] == [
        ("entity", "first"),
        ("architecture", "rtl"),
        ("entity", "second"),
    ]
    assert units[1].parent_name == "first"


def test_package_declaration_does_not_swallow_the_body() -> None:
    units = extract_design_units(
        """
        library ieee;
        use ieee.std_logic_1164.all;
        package utils_pkg is
          function is_zero(value : std_logic_vector) return boolean;
        end package utils_pkg;

        use ieee.numeric_std.all;
        package body utils_pkg is
          function is_zero(value : std_logic_vector) return boolean is
          begin
            return true;
          end function;
        end package body utils_pkg;
        """
    )
    assert [(unit.kind, unit.name) for unit in units] == [
        ("package", "utils_pkg"),
        ("package_body", "utils_pkg"),
    ]
    assert "library:ieee" in units[0].dependencies
    assert "use:ieee.std_logic_1164" in units[0].dependencies
    assert "use:ieee.numeric_std" in units[1].dependencies
    assert all(unit.parse_status == "skipped" for unit in units)


def test_integer_port_has_no_bit_width() -> None:
    unit = _unit(
        """
        entity numbers is
          port (limit : in integer);
        end entity numbers;
        """,
        "numbers",
    )
    assert unit.ports[0].width_status == "not_applicable"
    assert unit.ports[0].width is None
    assert not any(item.code == "width_unresolved" for item in unit.diagnostics)
