# Third-party notices

HDL-Maker itself is MIT-licensed. See `LICENSE`. The files below are not rewritten, not deleted, and not folded into that grant when their own terms differ.

## Author's library

`libs/sbus_rtc_lib` contains the author's VHDL designs and HDL Designer graphical files. The project owner holds the rights to those designs and permits their distribution under the MIT License.

The same tree also contains generated ModelSim output, including `work/*.qdb`, `work/*.qpg`, `work/*.wlf`, and transcript files. Those files are tool output. This repository does not relicense them, and it does not ship a ModelSim, Vivado, or Vitis executable. They stay where they are. Git history is not rewritten to remove them.

## Board definitions

`boardfiles/` holds Vivado 2019.1 board definitions used by the Target board list.

Digilent files that begin with an MIT copyright notice stay under that notice. Examples are `zybo/B.4/board.xml` (Copyright (c) 2021 Digilent, Inc.) and `zybo-z7-10/A.0/board.xml` (Copyright (c) 2025 Digilent, Inc.). Their headers are unchanged.

These `board.xml` files carry no copyright header in the file. They are listed so the MIT grant is not read as covering them:

- `ac701/1.2`, `ac701/1.3`, `ac701/1.4` (vendor `xilinx.com`)
- `li-imx274-mipi`
- `nexys-a7-50t/D.0/1.0` (vendor `digilentinc.com`; the later `1.3` file in the same family does carry a Digilent MIT header)
- `sp701/1.0`
- `xm105/1.0`
- `zc702/1.2`, `zc702/1.3`, `zc702/1.4`
- `zcu104/1.0`, `zcu104/1.1`
- `zcu106/2.0` through `zcu106/2.4`
- `zed/1.3`, `zed/1.4`

## Examples and dependencies

`examples/` is the small demonstration shipped with HDL-Maker and is part of this MIT project.

Python packages in `.venv` and the packages PyInstaller copies into a build keep the license files those packages ship. Node packages under `frontend/node_modules` do the same. Neither directory is the project license.
