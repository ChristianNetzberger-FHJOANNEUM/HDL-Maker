# O5 — International open-source distribution

O5 is a long-term, optional branch of the open-source roadmap. It asks whether HDL-Maker can be offered to universities, students, and independent developers who cannot obtain a proprietary FPGA toolchain. It does not block O2, O3, or O4. The next technical step remains O2b.

This file is a study plan and a record of sources read on 23 November 2026. It is not a classification, not an export licence, and not a statement that HDL-Maker may be sent to every country or every recipient. A final legal opinion belongs to a qualified body, in Austria the export-control authority or counsel instructed for that question. This repository does not build a way around an export restriction.

HDL-Maker stays MIT-licensed. Third-party tools keep their own licences. A file that runs on this machine is not, by that fact, a file that may be put into a public package.

## What is already shown

These results stay as they are. O5 does not restate them as an international release.

| Item | Status |
| --- | --- |
| M5b Vivado JTAG program of the Z7-20 counter, DONE and LED0 | Tested on hardware |
| O1 Windows open-source build of that counter through a bitstream | Investigated. The bitstream was not programmed. |
| O2a the same chain as a backend build | In the backend. Tested in software against the O1 reports. Not programmed. |
| O2b program the open-source bitstream | Tested on hardware. Green DONE LED. LED0 about 1 s. |
| V1 reduced Vivado install | Planned. License unresolved for redistribution. |
| O5a–O5e | Planned. License unresolved where a redistribution right has not been recorded. |

The open-source chain under study is GHDL, Yosys, nextpnr-xilinx / openXC7, Project X-Ray, FASM, and, later, openFPGALoader. openFPGALoader is present in the O1 tree and has not been run.

## Aim

A later education package should be able to work without:

- a proprietary licence server
- a vendor account or an activation service
- a Vivado or Vitis installation
- a proprietary FPGA IP core
- a vendor cloud service
- a network connection after the package is installed

Those are requirements for O5c. They are not claims about the package that exists today. The current student ZIP does not contain the FPGA tools. Vivado remains an optional local install and is not shipped.

Open source is not treated here as an exemption from export control or sanctions.

## O5a — Licence inventory

Planned. License unresolved for a redistributable set. The rows below record only texts this project has already read. They are not a completed bill of materials, and they do not cover every file inside OSS CAD Suite or a future ZIP.

Four groups are kept apart:

1. Source that is published under a stated licence.
2. Binaries whose redistribution terms have been read.
3. Components this project would compile itself.
4. Proprietary components that are not shipped.

| Component | What was read | Group today | Redistribution |
| --- | --- | --- | --- |
| HDL-Maker | `LICENSE`, MIT, copyright Christian Netzberger, 2026 | 1. Source in this repository | MIT stays the project licence. It does not relicense other files. |
| GHDL 6.0.0 Dunoon, mcode, the existing WinGet binary | `ghdl --version` says the GNU General Public License and does not name the version | 2. A binary already installed here. Not built by this project | SPDX identifier of this binary is not recorded. Unresolved. |
| Yosys 0.70+329, `b8d84f823`, inside OSS CAD Suite `2026-11-04` | `license/LICENSE.yosys` is the ISC licence and names further bundled libraries | 2. Binary in a local, gitignored archive | The Yosys text is ISC. The suite binary is not only that text. Unresolved for the whole archive. |
| nextpnr-xilinx `42d06c5f` | Upstream `COPYING` at that revision is a permissive grant. The fetched file does not print an SPDX identifier | 2. Binary inside the local openXC7 archive | Unresolved as a formal SPDX tag for the binary package. |
| OSS CAD Suite `nextpnr` `64c09988` | Same family of grant in `license/LICENSE.nextpnr`. This binary is not the Xilinx flow | 2. Present, not used for the Zynq build | Unresolved for redistribution. |
| Project X-Ray `db4f31e9` | Upstream `LICENSE` is a permissive grant, copyright 2017–2020 The Project X-Ray Authors. No SPDX heading in that file | 2. Tools inside the local openXC7 archive | Unresolved as a formal SPDX tag. |
| prjxray-db `0c3504f2` | Upstream `LICENSE` is CC0 1.0 | 2. Database inside the local archive | CC0-1.0 was read from that revision. The packaged tree had no `LICENSE` file of its own. |
| FASM 0.0.2.post66 | Package `LICENSE` and metadata classifier are Apache-2.0 | 2. Bundled with openXC7 | Apache-2.0 for that package. |
| openFPGALoader v1.2.0, `e3d8d947` | `license/LICENSE.openfpgaloader` is Apache-2.0 | 2. Present. Not run | Not yet part of a release. |
| GTKWave in OSS CAD Suite, revision `e40ba793`, described there as 3.4.0 | `license/LICENSE.gtkwave` says GPL-2.0-or-later and lists further copyright lines, including FastLZ and LZ4 | 2. Inside the suite. The M4a.1 test used a separate local GTKWave 3.3.100 whose licence file was not read here | Unresolved for a combined package. The two GTKWave builds are not the same binary. |
| Eigen 3.4.0 | Named in openXC7 `BUILD-INFO`. No Eigen licence file in that Windows package | 3 or 2, not yet separated | Unresolved. |
| Python packages in `backend/requirements.txt` | Names and ranges only: FastAPI, Uvicorn, Pydantic, pytest, httpx | Not inventoried | Unresolved. Transitive files were not read. |
| JavaScript packages in `frontend/package.json` | Vue, Pinia, Vue Flow, and the Vite toolchain | Not inventoried | Unresolved. `node_modules` is not the project licence. |
| Vivado, Vitis, and vendor IP | Not shipped. V1 is the install study | 4. Proprietary. The user supplies a local install | Not included in an open-source package. |
| `boardfiles/` | Digilent files with an MIT header stay under that header. Files with no header are listed in `docs/third-party-notices.md` | Mixed | An international pack does not assume the unheaded files may be shipped. |

A later O5a pass has to record, for every file that would actually be packed: project, publisher, version, source repository, SPDX identifier where the text states one, binary-distribution licence, device-database licence, redistribution conditions, required copyright notices, rules for modified versions, and any proprietary file the build still opens. Modified versions of GPL components have to carry that licence's notices. This note does not choose those notices yet.

## O5b — Export-control notes

Planned as a factual index. License unresolved in the sense that no authority has classified this project. Retrieved 23 November 2026. This section does not say that publication makes an export lawful, and it does not describe a way to avoid a control.

### European Union

Regulation (EU) 2021/821 sets up the Union regime for exports, brokering, technical assistance, transit, and transfer of dual-use items. CELEX 32021R0821. The text of Article 4 below was read from the consolidated version dated 8 November 2024:

https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02021R0821-20241108

Article 4 requires an authorisation for dual-use items that are not listed in Annex I when the exporter has been informed by the competent authority that the items are or may be intended for the uses in that article, including chemical, biological, or nuclear weapons and certain missiles, a military end-use where the destination is under an arms embargo, or use as parts of military items exported from a Member State without the required authorisation. An exporter who is aware of such an intended use must notify the authority. A Member State may also require authorisation where the exporter has grounds for suspecting that use. The recital before Article 4 states that an authorisation may also be required, under Articles 4, 5, 9, or 10, for some non-listed items.

Commission Delegated Regulation (EU) 2025/2003 of 8 September 2025 replaces Annex I. It was published in the Official Journal on 14 November 2025 and enters into force on the following day. ELI: http://data.europa.eu/eli/reg_del/2025/2003/oj . The General Software Note was read from that publication on 23 November 2026. Amendments to the articles of Regulation 2021/821 after the 8 November 2024 consolidation were not re-read line by line.

The General Software Note overrides controls in section D of Categories 1 to 9. Those categories do not control software which is any of the following:

- generally available to the public by unrestricted retail sale, including electronic transactions, and designed for installation by the user without further substantial support by the supplier
- in the public domain, as that annex defines the term
- the minimum necessary object code to install, operate, maintain, or repair items whose export has been authorised

The retail and minimum-object-code entries do not release software specified in Category 5, Part 2 (information security). The annex defines "in the public domain" as technology or software made available without restrictions on further dissemination, and it says that copyright restrictions do not remove technology or software from that definition. That definition is not a finding that HDL-Maker, or any dependency, is outside the regulation.

The General Technology Note is a separate control on technology required for the development, production, or use of controlled goods. Software, a bitstream, a device database, and a vendor IP core are not the same kind of item. This project has not classified any of them under Annex I.

### Austria

The Federal Ministry of Economy, Energy and Tourism (BMWET), Department II/2 Export Control, is the licensing authority for dual-use goods. The pages read on 23 November 2026 were:

- https://www.bmwet.gv.at/en/Topics/Export-Control.html
- https://www.bmwet.gv.at/Themen/Exportkontrolle/Export.html
- https://www.bmwet.gv.at/Ministerium/Rechtsvorschriften/aussenwirtschaftsrecht/Aussenwirtschaftsgesetz2011.html

Those pages name the Außenwirtschaftsgesetz 2011, the First Foreign Trade Regulation 2011, the Second Foreign Trade Regulation 2019, Regulation (EU) 2021/821, and UN, EU, and OSCE embargoes as further sources. They say a licence question depends on the item, the destination, the recipient, and the end use. Contact recorded there: exportkontrolle@bmwet.gv.at. This project has not asked that office for a classification.

### United States

15 CFR 734.7, read from the eCFR on 23 November 2026, says that unclassified technology or software that has been made available to the public without restrictions on further dissemination is published and is thus not technology or software subject to the EAR, with stated exceptions. One exception is that published encryption software classified under ECCN 5D002 remains subject to the EAR unless it is publicly available encryption object code in that ECCN and the corresponding source code meets 15 CFR 742.15(b). The eCFR page says the eCFR is authoritative but is not an official legal edition of the CFR.

https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-734/section-734.7

15 CFR 742.15(b), read the same day, says that publicly available encryption source code classified under ECCN 5D002 is not subject to the EAR, subject to a notification requirement when that source code provides or performs non-standard cryptography. The notification addresses named there are crypt@bis.doc.gov and enc@nsa.gov.

https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-742/section-742.15

This project has not determined whether any dependency is encryption software in that sense, and it has not sent a notification. A published-software rule is not a finding that a particular binary is outside the EAR.

### What stays open

- No Annex I or ECCN classification has been made.
- Sanctions and listed-person rules are separate from the software note. They were not applied to any recipient.
- Category 5, Part 2 is an explicit limit inside the General Software Note. Whether any bundled library falls there is unresolved.
- The 8 November 2024 consolidation is not the annex in force after Delegated Regulation 2025/2003. Article 4 was not re-read from a consolidation newer than 8 November 2024.
- A university course, a download, and a physical hand-out of the same files can be different transactions. This note does not sort them.

## O5c — International education edition

Planned. Not built. The shape, if a later decision adopts it, is two downloads rather than one archive of every FPGA family.

**HDL-Maker Core.** The studio, VHDL generation, and GHDL simulation. The end user does not run the npm development server. That split already exists for the portable Windows app: it serves the built page and the API on `127.0.0.1`. Waveform viewing is part of the core requirement. The current browser waveform view is still M4b. GTKWave remains an external program with its own licence.

**FPGA toolchain packs.** Separate free toolchains for families a study has actually built. A pack that has not been run is not listed as supported. Windows 11 is the first reference. Linux is later. A pack does not require Vivado, a vendor account, or a network connection after installation. VHDL-93 is the standard this chain has run. VHDL-2008 is offered only after the whole chain has been run with it. JTAG programming with a free tool is a requirement of this edition and is not implemented. openFPGALoader has not been used. Example projects and tutorials are part of the edition and are not written as an O5 deliverable yet.

The core can be installed where no FPGA pack is available. A pack is added only for a part the pack names.

## O5d — University cooperation

Planned as a use case, not as a clearance. One setting to study is teaching at FH Joanneum in Austria together with PAF-IAST in Haripur, Pakistan: the same HDL-Maker projects, pinned tool versions, and course materials.

The questions to answer before any such use are:

- a reproducible install on lab computers
- offline distribution only after the legal review in O5b
- course notes and example projects
- one recorded toolchain version at each site
- exchange of HDL projects without exchanging proprietary board or IP files
- English documentation
- an archive of the exact tools a course used, under the licences those tools allow

This file does not say that export to Pakistan, or to any other country, is allowed or refused. Recipient, end use, and sanctions are part of the review. They are not inferred from the name of a university.

## O5e — Technical independence

Planned, and already the direction of the architecture in [fpga-toolchain-architecture.md](fpga-toolchain-architecture.md). The studio documents stay the same model for every backend. VHDL is generated once. A backend does not get a second generator. An unsupported construct stays a diagnostic.

Later work can add capability profiles, more than one open toolchain, and either an open constraint form or a documented translation. The Z7-20 XDC is still the Vivado form. nextpnr accepts part of it and warns on `-name` and `-waveform`. That is a recorded limit, not a new constraint language.

Vendor-specific IP, a PS7 configuration flow, and Vitis are outside the open pack.

## Order

O2b remains the next technical step: program the open-source bitstream only after a separate approval, and compare LED0 with the Vivado result. O3 and O4 follow that evidence. O5 may be read and updated beside them. It does not wait on them for this document, and they do not wait on O5 for the Z7-20 work.

Before a public international binary distribution, these points still have to be closed:

1. A file-level licence inventory of the exact core archive and of each toolchain pack, including Python and JavaScript dependencies.
2. A split between published source, binaries that may be redistributed, components compiled by the project, and files that stay out.
3. The GPL notices for GHDL and GTKWave if a pack includes those binaries.
4. Whether any component is Category 5, Part 2 or EAR encryption software, and whether a notification applies.
5. A classification, if a qualified body says one is required. This file is not that classification.
6. Sanctions and end-use checks for the actual recipients. No country is pre-cleared here.
7. O2b, if the pack is described as programming a Xilinx 7-series part. A bitstream that has not been programmed is not a finished teaching flow for that board.
8. English course material and a stored copy of the toolchain versions the course uses.
