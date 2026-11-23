"""Compile the reference FSMs and compare morse_transmitter with its original.

Original files under libs/ are read and never written. Generated VHDL, the
testbench, traces, and the report stay under the workspace validation directory.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.editing.convert import editable_from_import
from app.hdl.analyze import analyze
from app.hdl.ghdl_run import LibraryProfile, GhdlStatus, ghdl_prefix, run_ghdl
from app.hdl.vhdl import VhdlStandard, render_vhdl
from app.importers.hds.extract import extract_graphical
from app.models.design import Diagnostic
from app.paths import repo_root, workspace_dir

LIBRARY = repo_root() / "libs" / "sbus_rtc_lib"
PACKAGES = ("utilities_pkg.vhd", "utilities_pkg_body.vhd")
MACHINES = (
    ("morse_transmitter", "morse_transmitter_fsm.vhd"),
    ("audio_fifo_ctrl", "audio_fifo_ctrl_fsm.vhd"),
    ("speed_trap", "speed_trap_fsm.vhd"),
)
RESET_FCW = "000000000000000100101100000"
PROGRAMMED_FCW = "000000000000000000001100100"

# Open-loop windows, counted in clock cycles after the previous window.
# The first command is held past the reset speed of 150 ms ticks.
STIMULUS = (
    (4, "01000001", "0001", "1"),
    (15_500_000, "01000001", "0001", "0"),
    (200_000, "01000000", "0001", "0"),
    (200_000, "02000064", "0001", "0"),
    (200_000, "02000000", "0001", "0"),
    (200_000, "00000000", "0001", "0"),
    (200_000, "01000001", "0000", "0"),
    (700_000, "04000000", "0001", "0"),
    (500_000, "03000001", "0001", "0"),
    (700_000, "03008000", "0001", "0"),
    (900_000, "0300C000", "0001", "0"),
    (8, "01000001", "0001", "1"),
)


def validation_dir() -> Path:
    path = workspace_dir() / "validation" / "m3c"
    path.mkdir(parents=True, exist_ok=True)
    return path


def check_machine(
    name: str,
    standard: VhdlStandard,
    profile: LibraryProfile,
    source: str,
    library: Path = LIBRARY,
    simulate: bool = False,
) -> dict:
    filename = dict(MACHINES)[name]
    result = _compile_one(name, filename, source, standard, profile, simulate, library)
    _write_report([result])
    return result


def compile_reference_machines(
    standard: VhdlStandard,
    profile: LibraryProfile = "synopsys",
    library: Path = LIBRARY,
) -> list[dict]:
    """Analyze and elaborate each original and generated machine. No simulation."""
    results: list[dict] = []
    for name, filename in MACHINES:
        for source in ("original", "generated"):
            results.append(_compile_one(name, filename, source, standard, profile, simulate=False, library=library))
    _write_report(results)
    return results


def compare_morse_transmitter(standard: VhdlStandard = "93", profile: LibraryProfile = "synopsys") -> dict:
    """Run the same open-loop stimulus on the original and the generated machine."""
    name, filename = MACHINES[0]
    original = _compile_one(name, filename, "original", standard, profile, simulate=True, library=LIBRARY)
    generated = _compile_one(name, filename, "generated", standard, profile, simulate=True, library=LIBRARY)
    comparison = _compare(original, generated, standard, profile)
    _write_report([original, generated, comparison])
    return comparison


def _compile_one(
    name: str,
    filename: str,
    source: str,
    standard: VhdlStandard,
    profile: LibraryProfile,
    simulate: bool,
    library: Path,
) -> dict:
    workdir = validation_dir() / standard / profile / name / source
    workdir.mkdir(parents=True, exist_ok=True)
    result = _blank(name, standard, profile, source)
    result["compiler_options"] = ghdl_prefix(standard, profile)
    dependencies = [library / "hdl" / item for item in PACKAGES]
    missing = [path for path in dependencies if not path.is_file()]
    if source == "original":
        unit = library / "hdl" / filename
        if not unit.is_file():
            missing.append(unit)
        units = [unit]
    else:
        generated, diagnostics = _generate(name, standard, workdir, library)
        result["diagnostics"] = diagnostics
        if generated is None:
            result["vhdl_generated"] = "failed"
            result["diagnostics"] = diagnostics or [
                _diagnostic("generation_failed", f"{name} produced no VHDL.", name)
            ]
            return result
        result["vhdl_generated"] = "passed"
        units = [generated]
    if missing:
        result["diagnostics"] = [
            _diagnostic("missing_dependency", f"Required library file is missing: {path}", str(path))
            for path in missing
        ]
        return result
    if source == "original":
        result["vhdl_generated"] = "not_run"
    analysis, elaboration = _analyze_and_elaborate(dependencies + units, name, workdir, standard, profile)
    result["ghdl_analysis"] = analysis[0]
    result["ghdl_elaboration"] = elaboration[0]
    if analysis[1]:
        result["diagnostics"].append(_diagnostic("ghdl_failed", analysis[1], str(units[-1])))
    elif elaboration[1]:
        result["diagnostics"].append(_diagnostic("ghdl_failed", elaboration[1], str(units[-1])))
    if not simulate or elaboration[0] != "passed":
        return result
    bench = workdir / "morse_compare_tb.vhd"
    bench.write_text(_testbench(), encoding="utf-8", newline="\n")
    code, detail = run_ghdl(
        ["-a", *ghdl_prefix(standard, profile), f"--workdir={workdir}", bench.name],
        workdir,
    )
    if code != 0:
        result["simulation"] = "failed"
        result["diagnostics"].append(_diagnostic("ghdl_failed", detail or "Testbench analysis failed.", str(bench)))
        return result
    code, detail = run_ghdl(
        ["-e", *ghdl_prefix(standard, profile), f"--workdir={workdir}", "morse_compare_tb"],
        workdir,
    )
    if code != 0:
        result["simulation"] = "failed"
        result["diagnostics"].append(_diagnostic("ghdl_failed", detail or "Testbench elaboration failed.", str(bench)))
        return result
    code, detail = run_ghdl(
        ["-r", *ghdl_prefix(standard, profile), f"--workdir={workdir}", "morse_compare_tb"],
        workdir,
        timeout=180,
    )
    trace = workdir / "trace.txt"
    result["trace_path"] = str(trace)
    result["simulator_notes"] = detail
    if code != 0 or not trace.is_file():
        result["simulation"] = "failed"
        result["diagnostics"].append(_diagnostic("ghdl_failed", detail or "Simulation failed.", str(trace)))
        return result
    result["simulation"] = "passed"
    result["trace"] = trace.read_text(encoding="utf-8")
    return result


def _generate(name: str, standard: VhdlStandard, workdir: Path, library: Path) -> tuple[Path | None, list[dict]]:
    path = library / "hds" / name / "fsm.sm"
    if not path.is_file():
        return None, [_diagnostic("missing_dependency", f"Required library file is missing: {path}", str(path))]
    text = path.read_text(encoding="utf-8", errors="replace")
    imported = extract_graphical(text, relative=path.relative_to(library).as_posix(), file_hash="c" * 64, library_id="lib_m3c")
    diagram = editable_from_import(imported, [])

    def load(diagram_id: str):
        if diagram_id != diagram.id:
            raise KeyError(diagram_id)
        return diagram

    designs, diagnostics = analyze(diagram, standard, load)
    payload = [_diagnostic(item.code, item.message, item.path) for item in diagnostics]
    if any(item.severity == "error" for item in diagnostics) or not designs:
        return None, payload
    rendered = render_vhdl(designs[-1], standard)
    target = workdir / f"{designs[-1].entity_name}.vhd"
    target.write_text(rendered, encoding="utf-8", newline="\n")
    return target, payload


def _analyze_and_elaborate(
    units: list[Path],
    top: str,
    workdir: Path,
    standard: VhdlStandard,
    profile: LibraryProfile,
) -> tuple[tuple[GhdlStatus, str], tuple[GhdlStatus, str]]:
    prefix = ghdl_prefix(standard, profile)
    for unit in units:
        code, detail = run_ghdl(["-a", *prefix, f"--workdir={workdir}", str(unit)], workdir)
        if code is None:
            return ("not_run", detail), ("not_run", "")
        if code != 0:
            return ("failed", detail), ("not_run", "")
    code, detail = run_ghdl(["-e", *prefix, f"--workdir={workdir}", top], workdir)
    if code is None:
        return ("passed", ""), ("not_run", detail)
    if code != 0:
        return ("passed", ""), ("failed", detail)
    return ("passed", ""), ("passed", "")


def _compare(original: dict, generated: dict, standard: VhdlStandard, profile: LibraryProfile) -> dict:
    result = _blank("morse_transmitter", standard, profile, "comparison")
    result["compiler_options"] = ghdl_prefix(standard, profile)
    result["vhdl_generated"] = generated["vhdl_generated"]
    result["ghdl_analysis"] = _both(original["ghdl_analysis"], generated["ghdl_analysis"])
    result["ghdl_elaboration"] = _both(original["ghdl_elaboration"], generated["ghdl_elaboration"])
    result["simulation"] = _both(original["simulation"], generated["simulation"])
    result["diagnostics"] = original["diagnostics"] + generated["diagnostics"]
    if result["simulation"] != "passed":
        return result
    expected = original.get("trace", "")
    actual = generated.get("trace", "")
    gaps = _landmarks(expected)
    if gaps:
        result["functional_comparison"] = "failed"
        result["landmarks"] = gaps
        result["diagnostics"].append(
            _diagnostic("stimulus_incomplete", "The stimulus did not reach the required morse_transmitter behavior. " + "; ".join(gaps), "morse_transmitter")
        )
        return result
    result["landmarks"] = []
    result["cycles"] = _cycle_count(expected)
    result["observed"] = _observed(expected)
    if expected == actual:
        result["functional_comparison"] = "passed"
        result["differences"] = []
        return result
    found = _differences(expected, actual)
    result["functional_comparison"] = "failed"
    result["differences"] = found
    result["diagnostics"].append(
        _diagnostic(
            "functional_mismatch",
            f"{len(found)} output difference(s) between the original and generated morse_transmitter.",
            "morse_transmitter",
        )
    )
    return result


def _cycle_count(trace: str) -> int | None:
    for line in trace.splitlines():
        if line.startswith("END "):
            return int(line.split()[1])
    return None


def _observed(trace: str) -> dict:
    rows = _rows(trace)
    return {
        "fifo_rd_pulses": sum(1 for _cycle, rd, _code, _fcw in rows if rd == "1"),
        "morse_code_low_runs": _low_runs(rows),
        "morse_fcw_values": sorted({value for _cycle, _rd, _code, value in rows}),
    }


def _landmarks(trace: str) -> list[str]:
    rows = _rows(trace)
    missing: list[str] = []
    pulses = sum(1 for _cycle, rd, _code, _fcw in rows if rd == "1")
    if pulses < 4:
        missing.append(f"fifo_rd pulsed {pulses} time(s); expected at least 4")
    fcw = {value for _cycle, _rd, _code, value in rows}
    if RESET_FCW not in fcw:
        missing.append("reset morse_fcw 2400 was not observed")
    if PROGRAMMED_FCW not in fcw:
        missing.append("programmed morse_fcw 100 was not observed")
    lows = _low_runs(rows)
    if len(lows) < 2 or max(lows) <= min(lows):
        missing.append(f"morse_code low runs were {lows}; expected two different lengths")
    return missing


def _low_runs(rows: list[tuple[int, str, str, str]]) -> list[int]:
    runs: list[int] = []
    start: int | None = None
    for cycle, _rd, code, _fcw in rows:
        if code == "0" and start is None:
            start = cycle
        elif code != "0" and start is not None:
            runs.append(cycle - start)
            start = None
    return runs


def _differences(expected_text: str, actual_text: str) -> list[dict]:
    expected = _rows(expected_text)
    actual = _rows(actual_text)
    left = right = 0
    last_expected = ("U", "U", "U" * 27)
    last_actual = ("U", "U", "U" * 27)
    found: list[dict] = []
    names = ("fifo_rd", "morse_code", "morse_fcw")
    while left < len(expected) or right < len(actual):
        next_left = expected[left][0] if left < len(expected) else None
        next_right = actual[right][0] if right < len(actual) else None
        if next_right is None or (next_left is not None and next_left <= next_right):
            cycle = next_left
        else:
            cycle = next_right
        if next_left == cycle:
            last_expected = expected[left][1:]
            left += 1
        if next_right == cycle:
            last_actual = actual[right][1:]
            right += 1
        for name, old, new in zip(names, last_expected, last_actual, strict=True):
            if old != new:
                found.append({"cycle": cycle, "signal": name, "expected": old, "actual": new})
        if len(found) >= 20:
            break
    return found


def _rows(trace: str) -> list[tuple[int, str, str, str]]:
    rows: list[tuple[int, str, str, str]] = []
    for line in trace.splitlines():
        if not line or line.startswith("END"):
            continue
        cycle, rd, code, fcw = line.split()
        rows.append((int(cycle), rd, code, fcw))
    return rows


def _both(left: GhdlStatus, right: GhdlStatus) -> GhdlStatus:
    if left == "failed" or right == "failed":
        return "failed"
    if left == "not_run" or right == "not_run":
        return "not_run"
    return "passed"


def _blank(name: str, standard: str, profile: str, source: str) -> dict:
    return {
        "machine": name,
        "vhdl_standard": standard,
        "library_profile": profile,
        "source": source,
        "vhdl_generated": "not_run",
        "ghdl_analysis": "not_run",
        "ghdl_elaboration": "not_run",
        "simulation": "not_run",
        "functional_comparison": "not_run",
        "diagnostics": [],
        "differences": [],
        "compiler_options": [],
    }


def _diagnostic(code: str, message: str, path: str | None) -> dict:
    item = Diagnostic(severity="error", code=code, message=message, path=path)
    return item.model_dump(mode="json")


def _write_report(entries: list[dict]) -> None:
    stored = []
    for entry in entries:
        copied = dict(entry)
        copied.pop("trace", None)
        stored.append(copied)
    target = validation_dir() / "report.json"
    previous: list[dict] = []
    if target.is_file():
        previous = json.loads(target.read_text(encoding="utf-8"))
    keys = {(item["machine"], item["vhdl_standard"], item["library_profile"], item["source"]) for item in stored}
    merged = [item for item in previous if (item["machine"], item["vhdl_standard"], item["library_profile"], item["source"]) not in keys]
    merged.extend(stored)
    target.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")


def _testbench() -> str:
    windows = "\n".join(
        f'    drive({count}, x"{data}", x"{size}", \'{reset}\');' for count, data, size, reset in STIMULUS
    )
    return f"""library ieee;
use ieee.std_logic_1164.all;
use std.textio.all;

entity morse_compare_tb is
end entity;

architecture sim of morse_compare_tb is
  signal clk : std_logic := '0';
  signal reset : std_logic := '1';
  signal fifo_data : std_logic_vector(31 downto 0) := x"01000001";
  signal fifo_size : std_logic_vector(15 downto 0) := x"0001";
  signal fifo_rd : std_logic;
  signal morse_code : std_logic;
  signal morse_fcw : std_logic_vector(26 downto 0);

  function sl_char(value : std_logic) return character is
  begin
    case value is
      when 'U' => return 'U';
      when 'X' => return 'X';
      when '0' => return '0';
      when '1' => return '1';
      when 'Z' => return 'Z';
      when 'W' => return 'W';
      when 'L' => return 'L';
      when 'H' => return 'H';
      when '-' => return '-';
    end case;
  end function;

  function slv_text(value : std_logic_vector) return string is
    variable text : string(1 to value'length);
    variable index : integer := 1;
  begin
    for bit_index in value'range loop
      text(index) := sl_char(value(bit_index));
      index := index + 1;
    end loop;
    return text;
  end function;
begin
  uut : entity work.morse_transmitter(fsm)
    port map (
      clk => clk,
      fifo_data => fifo_data,
      fifo_size => fifo_size,
      reset => reset,
      fifo_rd => fifo_rd,
      morse_code => morse_code,
      morse_fcw => morse_fcw
    );

  stimulus : process
    file log_file : text open write_mode is "trace.txt";
    variable line_out : line;
    variable cycle : integer := 0;
    variable seen_rd : std_logic := 'U';
    variable seen_code : std_logic := 'U';
    variable seen_fcw : std_logic_vector(26 downto 0) := (others => 'U');

    procedure note is
    begin
      if fifo_rd /= seen_rd or morse_code /= seen_code or morse_fcw /= seen_fcw then
        seen_rd := fifo_rd;
        seen_code := morse_code;
        seen_fcw := morse_fcw;
        write(line_out, cycle);
        write(line_out, ' ');
        write(line_out, sl_char(fifo_rd));
        write(line_out, ' ');
        write(line_out, sl_char(morse_code));
        write(line_out, ' ');
        write(line_out, slv_text(morse_fcw));
        writeline(log_file, line_out);
      end if;
    end procedure;

    procedure clocks(count : integer) is
    begin
      for index in 1 to count loop
        clk <= '0';
        wait for 5 ns;
        clk <= '1';
        wait for 1 ns;
        cycle := cycle + 1;
        note;
      end loop;
    end procedure;

    procedure drive(
      count : integer;
      data : std_logic_vector(31 downto 0);
      size : std_logic_vector(15 downto 0);
      reset_value : std_logic
    ) is
    begin
      fifo_data <= data;
      fifo_size <= size;
      reset <= reset_value;
      clocks(count);
    end procedure;
  begin
{windows}
    write(line_out, string'("END "));
    write(line_out, cycle);
    writeline(log_file, line_out);
    wait;
  end process;
end architecture;
"""
