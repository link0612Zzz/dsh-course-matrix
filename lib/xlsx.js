/**
 * Minimal zero-dependency .xlsx writer.
 *
 * Produces an Office Open XML spreadsheet (zip + XML) without any npm package,
 * so the bundle installs without running npm install or build scripts.
 *
 * Supported: multiple sheets, column widths, row heights, frozen panes,
 * auto-filter, inline strings, numbers, and a small fixed style set
 * (bold/plain font, solid fill, thin border, wrap/center alignment).
 *
 * Not supported: formulas, charts, data validation, conditional formatting.
 */
import zlib from 'node:zlib'

/* ------------------------------------------------------------------ zip ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function dosTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f)
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f)
  return { time, day }
}

/** Build an uncompressed-entry zip archive. */
function zip(files) {
  const now = new Date()
  const { time, day } = dosTime(now)
  const locals = []
  const centrals = []
  let offset = 0

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8')
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8')
    const raw = zlib.deflateRawSync(data)
    // Store when deflate does not help (tiny XML snippets).
    const useRaw = raw.length >= data.length
    const payload = useRaw ? data : raw
    const method = useRaw ? 0 : 8
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, payload)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(day, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(payload.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)

    offset += local.length + nameBuf.length + payload.length
  }

  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, centralBuf, end])
}

/* ------------------------------------------------------------------ xml ---- */

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Strip control characters that XML 1.0 forbids.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

function colName(index) {
  let name = ''
  let n = index
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

/* --------------------------------------------------------------- styles ---- */

const FONT_PLAIN = 0
const FONT_BOLD = 1
const FONT_HEADER = 2 // bold + white

const FILL_NONE = 0
const FILL_GRAY = 1
const FILL_HEADER = 2

/**
 * Fixed cell style ids understood by cell.style in the public API.
 * Each maps to a (font, fill, border, alignment) combination.
 */
const STYLES = {
  default: { font: FONT_PLAIN, fill: FILL_NONE, border: true, wrap: true, center: false },
  header: { font: FONT_HEADER, fill: FILL_HEADER, border: true, wrap: true, center: true },
  bold: { font: FONT_BOLD, fill: FILL_NONE, border: true, wrap: true, center: false },
  center: { font: FONT_PLAIN, fill: FILL_NONE, border: true, wrap: true, center: true },
  gray: { font: FONT_PLAIN, fill: FILL_GRAY, border: true, wrap: true, center: false },
  plain: { font: FONT_PLAIN, fill: FILL_NONE, border: false, wrap: true, center: false },
}

function stylesXml() {
  const fonts = [
    '<font><sz val="10"/><name val="Calibri"/></font>',
    '<font><b/><sz val="10"/><name val="Calibri"/></font>',
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
  ]
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/><bgColor indexed="64"/></patternFill></fill>',
  ]
  const border =
    '<border><left style="thin"><color rgb="FFBFBFBF"/></left>'
    + '<right style="thin"><color rgb="FFBFBFBF"/></right>'
    + '<top style="thin"><color rgb="FFBFBFBF"/></top>'
    + '<bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>'
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', border]

  const names = Object.keys(STYLES)
  const xfs = names.map((name) => {
    const s = STYLES[name]
    const align = `<alignment vertical="top"${s.wrap ? ' wrapText="1"' : ''}${s.center ? ' horizontal="center"' : ''}/>`
    return `<xf numFmtId="0" fontId="${s.font}" fillId="${s.fill}" borderId="${s.border ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`
  })

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`
    + `<fills count="${fills.length}">${fills.join('')}</fills>`
    + `<borders count="${borders.length}">${borders.join('')}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>'
}

/* ---------------------------------------------------------------- sheet ---- */

function styleIndex(style) {
  const idx = Object.keys(STYLES).indexOf(style)
  return idx < 0 ? 0 : idx
}

function cellXml(ref, cell) {
  if (cell === null || cell === undefined || cell === '') {
    const s = styleIndex('default')
    return `<c r="${ref}" s="${s}"/>`
  }
  const style = typeof cell === 'object' && cell.style ? cell.style : 'default'
  const value = typeof cell === 'object' && 'value' in cell ? cell.value : cell
  const s = styleIndex(style)
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${s}"/>`
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${s}"><v>${value}</v></c>`
  }
  const text = esc(value).replace(/\n/g, '&#10;')
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
}

function sheetXml(sheet) {
  const rows = sheet.rows || []
  const widths = sheet.widths || []
  const freeze = sheet.freeze // { row, col } 1-based frozen counts
  const autoFilter = sheet.autoFilter

  const cols = widths.length
    ? '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>'
    : ''

  const sheetViews = freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${freeze.col || 0}" ySplit="${freeze.row || 0}" `
      + `topLeftCell="${colName((freeze.col || 0) + 1)}${(freeze.row || 0) + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'

  const body = rows.map((row, r) => {
    const height = sheet.rowHeights && sheet.rowHeights[r]
    const attrs = `r="${r + 1}"${height ? ` ht="${height}" customHeight="1"` : ''}`
    const cells = (row || []).map((cell, c) => cellXml(`${colName(c + 1)}${r + 1}`, cell)).join('')
    return `<row ${attrs}>${cells}</row>`
  }).join('')

  const filter = autoFilter && rows.length
    ? `<autoFilter ref="A1:${colName(Math.max(1, Math.max(...rows.map(r => (r || []).length))))}${rows.length}"/>`
    : ''

  const dimension = rows.length
    ? `A1:${colName(Math.max(1, Math.max(...rows.map(r => (r || []).length))))}${rows.length}`
    : 'A1'

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<dimension ref="${dimension}"/>`
    + sheetViews
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + cols
    + `<sheetData>${body}</sheetData>`
    + filter
    + '</worksheet>'
}

/* --------------------------------------------------------------- public ---- */

/**
 * Build an .xlsx workbook buffer.
 * @param {Array<{name: string, widths?: number[], rowHeights?: number[], freeze?: {row?: number, col?: number}, autoFilter?: boolean, rows: any[][]}>} sheets
 *   Each row cell is a primitive, or `{ value, style }` where style is one of
 *   default | header | bold | center | gray | plain.
 * @returns {Buffer}
 */
export function buildXlsx(sheets) {
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error('buildXlsx: at least one sheet is required')

  const usedNames = new Set()
  const normalized = sheets.map((sheet, i) => {
    let name = String(sheet.name || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || `Sheet${i + 1}`
    let n = 2
    while (usedNames.has(name)) name = `${name.slice(0, 28)}_${n++}`
    usedNames.add(name)
    return { ...sheet, name }
  })

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + normalized.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>'

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>'

  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets>'
    + normalized.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets></workbook>'

  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + normalized.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${normalized.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>'

  const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: stylesXml() },
    ...normalized.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ]

  return zip(files)
}
