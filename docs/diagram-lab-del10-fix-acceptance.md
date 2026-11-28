# DEL10 fix — manual re-test

**Pre-fix result (28 Nov 2026):** DEL10 **failed** — survivor renamed `CLK_1`, canonical `netId` split.  
**Fix landed:** `reassignComponents` splits only when one geometric component fractures (Fall B).

**Automated:** `DEL10-R1` … `DEL10-R10` in `selfcheck.ts` — green.

## Checklist — **7/7 passed** (28 Nov 2026)

| ID | Expected | Result |
| --- | --- | --- |
| R1 | Three CLK stubs — delete one input | **Pass** |
| R2 | Delete output stub | **Pass** |
| R3 | Delete block with CLK stub | **Pass** |
| R4 | Bridge/junction segment delete → `out` / `out_1` split | **Pass** |
| R5 | Undo/Redo | **Pass** |
| R6 | Save/Load | **Pass** |
| R7 | Automatic arrows | **Pass** |

**Pre-fix DEL10 (first pass):** failed — survivor renamed `CLK_1` (documented in [investigation](diagram-lab-del10-net-split-investigation.md) §2).

**Automated:** `DEL10-R1` … `DEL10-R10` in `selfcheck.ts`.

---

**Closed** with P5c-DEL 10/10 and git checkpoint (Nov 2026).