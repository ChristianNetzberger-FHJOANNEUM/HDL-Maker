import type { ImageAsset } from './document'

/** Hand-drawn reference pictures. They are graphics only: no electrical model and no HDL. */

export type PictureSource = {
  assetId: string
  fileName: string
  symbolId: string
  title: string
  label: string
  pins: Array<{ id: string; name: string; side: 'left' | 'right' | 'top' | 'bottom'; t: number }>
  svg: string
}

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">${body}</svg>`

export const PICTURE_SOURCES: PictureSource[] = [
  {
    assetId: 'ast_led',
    fileName: 'led.svg',
    symbolId: 'sym_led',
    title: 'LED',
    label: 'LED',
    pins: [
      { id: 'pin_led_a', name: 'A', side: 'left', t: 0.5 },
      { id: 'pin_led_k', name: 'K', side: 'right', t: 0.5 },
    ],
    svg: svg(
      '<circle cx="48" cy="40" r="16" fill="none" stroke="#243140" stroke-width="2"/>' +
        '<path d="M36 28 L60 52 M60 28 L36 52" fill="none" stroke="#243140" stroke-width="2"/>' +
        '<path d="M66 24 L76 16 M72 32 L86 26" fill="none" stroke="#243140" stroke-width="2"/>' +
        '<path d="M12 40 H32 M64 40 H108" fill="none" stroke="#243140" stroke-width="2"/>',
    ),
  },
  {
    assetId: 'ast_switch',
    fileName: 'switch.svg',
    symbolId: 'sym_switch',
    title: 'Switch',
    label: 'SW',
    pins: [
      { id: 'pin_sw_a', name: '1', side: 'left', t: 0.35 },
      { id: 'pin_sw_b', name: '2', side: 'left', t: 0.7 },
      { id: 'pin_sw_c', name: '3', side: 'right', t: 0.5 },
    ],
    svg: svg(
      '<circle cx="28" cy="26" r="3" fill="#243140"/>' +
        '<circle cx="28" cy="54" r="3" fill="#243140"/>' +
        '<circle cx="92" cy="40" r="3" fill="#243140"/>' +
        '<path d="M31 28 L86 38" fill="none" stroke="#243140" stroke-width="2"/>' +
        '<path d="M12 26 H28 M12 54 H28 M95 40 H108" fill="none" stroke="#243140" stroke-width="2"/>',
    ),
  },
  {
    assetId: 'ast_meter',
    fileName: 'meter.svg',
    symbolId: 'sym_meter',
    title: 'Meter',
    label: 'M',
    pins: [
      { id: 'pin_meter_p', name: '+', side: 'left', t: 0.35 },
      { id: 'pin_meter_n', name: '-', side: 'left', t: 0.7 },
    ],
    svg: svg(
      '<circle cx="64" cy="40" r="26" fill="#f7fafc" stroke="#243140" stroke-width="2"/>' +
        '<path d="M64 40 L84 26" fill="none" stroke="#1d6fd6" stroke-width="2"/>' +
        '<circle cx="64" cy="40" r="2" fill="#243140"/>' +
        '<path d="M46 52 H82" fill="none" stroke="#243140" stroke-width="1"/>',
    ),
  },
  {
    assetId: 'ast_board',
    fileName: 'board.svg',
    symbolId: 'sym_board',
    title: 'FPGA board',
    label: 'FPGA',
    pins: [
      { id: 'pin_board_sw', name: 'SW', side: 'left', t: 0.3 },
      { id: 'pin_board_led', name: 'LED', side: 'right', t: 0.3 },
      { id: 'pin_board_jb', name: 'JB', side: 'bottom', t: 0.5 },
    ],
    svg: svg(
      '<rect x="8" y="10" width="104" height="60" rx="4" fill="#12324d" stroke="#243140"/>' +
        '<rect x="46" y="24" width="28" height="28" fill="#d9e3ee" stroke="#243140"/>' +
        '<circle cx="22" cy="24" r="4" fill="#d4554a"/>' +
        '<circle cx="34" cy="24" r="4" fill="#3c9a4a"/>' +
        '<rect x="16" y="48" width="16" height="8" fill="#e8eef4" stroke="#243140"/>' +
        '<rect x="86" y="46" width="14" height="12" fill="#e8eef4" stroke="#243140"/>',
    ),
  },
  {
    assetId: 'ast_oscillator',
    fileName: 'oscillator.svg',
    symbolId: 'sym_oscillator',
    title: 'Oscillator',
    label: 'OSC',
    pins: [
      { id: 'pin_osc_out', name: 'out', side: 'right', t: 0.5 },
      { id: 'pin_osc_gnd', name: 'gnd', side: 'bottom', t: 0.5 },
    ],
    svg: svg(
      '<rect x="16" y="16" width="88" height="48" fill="#fbfcfd" stroke="#243140" stroke-width="2"/>' +
        '<path d="M28 40 C36 40 36 24 44 24 C52 24 52 56 60 56 C68 56 68 40 76 40 C84 40 84 40 92 40" fill="none" stroke="#1d6fd6" stroke-width="2"/>',
    ),
  },
]

const PACKED: Record<string, { checksum: string; data: string }> = {
  ast_led: {
    checksum: 'de0c16369275bdab28048dfd948ef57b4c1241ff3abc44cff3d6a9a941aeb905',
    data: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAxMjAgODAiPjxjaXJjbGUgY3g9IjQ4IiBjeT0iNDAiIHI9IjE2IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNDMxNDAiIHN0cm9rZS13aWR0aD0iMiIvPjxwYXRoIGQ9Ik0zNiAyOCBMNjAgNTIgTTYwIDI4IEwzNiA1MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjQzMTQwIiBzdHJva2Utd2lkdGg9IjIiLz48cGF0aCBkPSJNNjYgMjQgTDc2IDE2IE03MiAzMiBMODYgMjYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzI0MzE0MCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTEyIDQwIEgzMiBNNjQgNDAgSDEwOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjQzMTQwIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
  },
  ast_switch: {
    checksum: 'dcf31724a436fac74bf117e2093190b0e3bb09fb8a18650f14d727d249048863',
    data: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAxMjAgODAiPjxjaXJjbGUgY3g9IjI4IiBjeT0iMjYiIHI9IjMiIGZpbGw9IiMyNDMxNDAiLz48Y2lyY2xlIGN4PSIyOCIgY3k9IjU0IiByPSIzIiBmaWxsPSIjMjQzMTQwIi8+PGNpcmNsZSBjeD0iOTIiIGN5PSI0MCIgcj0iMyIgZmlsbD0iIzI0MzE0MCIvPjxwYXRoIGQ9Ik0zMSAyOCBMODYgMzgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzI0MzE0MCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTEyIDI2IEgyOCBNMTIgNTQgSDI4IE05NSA0MCBIMTA4IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNDMxNDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
  },
  ast_meter: {
    checksum: '0bea1e6c6bc4b9641ab710b15bbf6178b512156c59137c7ccca1921db9deac49',
    data: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAxMjAgODAiPjxjaXJjbGUgY3g9IjY0IiBjeT0iNDAiIHI9IjI2IiBmaWxsPSIjZjdmYWZjIiBzdHJva2U9IiMyNDMxNDAiIHN0cm9rZS13aWR0aD0iMiIvPjxwYXRoIGQ9Ik02NCA0MCBMODQgMjYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFkNmZkNiIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iNjQiIGN5PSI0MCIgcj0iMiIgZmlsbD0iIzI0MzE0MCIvPjxwYXRoIGQ9Ik00NiA1MiBIODIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzI0MzE0MCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+',
  },
  ast_board: {
    checksum: 'e89f786437cc9fe781cd85d4083143ea670cacf3ff84fd7dca1f0e0e77da9d5f',
    data: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAxMjAgODAiPjxyZWN0IHg9IjgiIHk9IjEwIiB3aWR0aD0iMTA0IiBoZWlnaHQ9IjYwIiByeD0iNCIgZmlsbD0iIzEyMzI0ZCIgc3Ryb2tlPSIjMjQzMTQwIi8+PHJlY3QgeD0iNDYiIHk9IjI0IiB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIGZpbGw9IiNkOWUzZWUiIHN0cm9rZT0iIzI0MzE0MCIvPjxjaXJjbGUgY3g9IjIyIiBjeT0iMjQiIHI9IjQiIGZpbGw9IiNkNDU1NGEiLz48Y2lyY2xlIGN4PSIzNCIgY3k9IjI0IiByPSI0IiBmaWxsPSIjM2M5YTRhIi8+PHJlY3QgeD0iMTYiIHk9IjQ4IiB3aWR0aD0iMTYiIGhlaWdodD0iOCIgZmlsbD0iI2U4ZWVmNCIgc3Ryb2tlPSIjMjQzMTQwIi8+PHJlY3QgeD0iODYiIHk9IjQ2IiB3aWR0aD0iMTQiIGhlaWdodD0iMTIiIGZpbGw9IiNlOGVlZjQiIHN0cm9rZT0iIzI0MzE0MCIvPjwvc3ZnPg==',
  },
  ast_oscillator: {
    checksum: '2ed3911757cc113286ce56fb9f2bfcb942268d1b9f0e3602b10a9a1fd6c58f7b',
    data: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAxMjAgODAiPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9Ijg4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZmJmY2ZkIiBzdHJva2U9IiMyNDMxNDAiIHN0cm9rZS13aWR0aD0iMiIvPjxwYXRoIGQ9Ik0yOCA0MCBDMzYgNDAgMzYgMjQgNDQgMjQgQzUyIDI0IDUyIDU2IDYwIDU2IEM2OCA1NiA2OCA0MCA3NiA0MCBDODQgNDAgODQgNDAgOTIgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFkNmZkNiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
  },
}

export function pictureAssets(): ImageAsset[] {
  return PICTURE_SOURCES.map((source) => {
    const packed = PACKED[source.assetId]
    return {
      id: source.assetId,
      name: source.fileName,
      mime: 'image/svg+xml',
      data: packed.data,
      width: 120,
      height: 80,
      checksum: packed.checksum,
      origin: 'diagram-lab',
      license: 'MIT',
    }
  })
}
