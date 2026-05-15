import { Buffer } from 'buffer'

const VALID_SIGNATURE = 0x0510
const COLOR_NUMBER_LENGTH = 10
const COLOR_NAME_LENGTH = 40
const FABRIC_COLOR_NAME_LENGTH = 40
const FONT_NAME_LENGTH = 32
const FORMAT_LENGTH = 240
const STITCH_TYPES_NUMBER = 9
const PAGE_HEADER_AND_FOOTER_LENGTH = 119

function decodeCStringBytes(bytes) {
  const zeroIndex = bytes.indexOf(0)
  const body = zeroIndex >= 0 ? bytes.subarray(0, zeroIndex) : bytes
  if (!body.length) return ''

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch (_) {}

  try {
    return new TextDecoder('windows-1251').decode(body)
  } catch (_) {}

  return Buffer.from(body).toString('latin1')
}

class BinaryCursor {
  constructor(buffer) {
    this.buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    this.offset = 0
  }

  ensure(length) {
    if (this.offset + length > this.buffer.length) {
      throw new Error(`XSD parse out of range at ${this.offset}, need ${length}`)
    }
  }

  skip(length) {
    this.ensure(length)
    this.offset += length
  }

  readUInt8() {
    this.ensure(1)
    return this.buffer.readUInt8(this.offset++)
  }

  readUInt16LE() {
    this.ensure(2)
    const value = this.buffer.readUInt16LE(this.offset)
    this.offset += 2
    return value
  }

  readUInt32LE() {
    this.ensure(4)
    const value = this.buffer.readUInt32LE(this.offset)
    this.offset += 4
    return value
  }

  readBytes(length) {
    this.ensure(length)
    const value = this.buffer.subarray(this.offset, this.offset + length)
    this.offset += length
    return value
  }

  readCString(length) {
    return decodeCStringBytes(this.readBytes(length + 1))
  }

  readHexColor() {
    const bytes = this.readBytes(3)
    return `#${Buffer.from(bytes).toString('hex').toUpperCase()}`
  }
}

function parsePalette(cursor) {
  const paletteSize = cursor.readUInt16LE()
  const items = []

  for (let i = 0; i < paletteSize; i++) {
    cursor.skip(2)
    cursor.readUInt8() // brand id
    const number = cursor.readCString(COLOR_NUMBER_LENGTH)
    const name = cursor.readCString(COLOR_NAME_LENGTH)
    const color = cursor.readHexColor()
    cursor.skip(1)

    const blendsCount = cursor.readUInt16LE()
    if (blendsCount > 4) {
      throw new Error(`Invalid XSD blend count: ${blendsCount}`)
    }

    for (let j = 0; j < blendsCount; j++) {
      cursor.skip(1)
      cursor.readCString(COLOR_NUMBER_LENGTH)
    }
    cursor.skip((4 - blendsCount) * 12)

    for (let j = 0; j < blendsCount; j++) cursor.skip(1)
    cursor.skip(4 - blendsCount)

    cursor.readUInt32LE() // bead flag
    cursor.skip(4) // bead size or trash data
    cursor.skip(2)

    items.push({ number, name, color })
  }

  cursor.skip(paletteSize * 2)

  for (let i = 0; i < paletteSize; i++) {
    for (let stitchType = 0; stitchType < STITCH_TYPES_NUMBER; stitchType++) {
      const noteLength = cursor.readUInt16LE()
      cursor.skip(noteLength)
    }
  }

  // Strands block: 8 u16 values per palette item.
  cursor.skip(paletteSize * 16)

  return { paletteSize, items }
}

function readSymbolFormats(cursor, paletteSize) {
  const formats = []
  for (let i = 0; i < paletteSize; i++) {
    const useAltBgColor = cursor.readUInt16LE() === 1
    const backgroundColor = cursor.readHexColor()
    cursor.skip(1)
    const foregroundColor = cursor.readHexColor()
    cursor.skip(1)
    formats.push({ useAltBgColor, backgroundColor, foregroundColor })
  }
  cursor.skip((FORMAT_LENGTH - paletteSize) * 10)
  return formats
}

function skipLineFormats(cursor, paletteSize) {
  cursor.skip(paletteSize * 10)
  cursor.skip((FORMAT_LENGTH - paletteSize) * 10)
}

function skipNodeFormats(cursor, paletteSize) {
  cursor.skip(paletteSize * 10)
  cursor.skip((FORMAT_LENGTH - paletteSize) * 10)
}

function readFontFormats(cursor, paletteSize) {
  const formats = []
  for (let i = 0; i < paletteSize; i++) {
    let fontName = cursor.readCString(FONT_NAME_LENGTH)
    if (fontName === 'default') fontName = null
    cursor.skip(2)
    const bold = cursor.readUInt16LE() === 700
    const italic = cursor.readUInt8() === 1
    cursor.skip(11)
    const stitchSize = cursor.readUInt16LE()
    const smallStitchSize = cursor.readUInt16LE()
    formats.push({ fontName, bold, italic, stitchSize, smallStitchSize })
  }
  cursor.skip((FORMAT_LENGTH - paletteSize) * 53)
  return formats
}

function parseFormatsAndSymbols(cursor, paletteSize) {
  const symbolFormats = readSymbolFormats(cursor, paletteSize)
  skipLineFormats(cursor, paletteSize)
  cursor.skip(FORMAT_LENGTH * 4)
  skipLineFormats(cursor, paletteSize)
  skipLineFormats(cursor, paletteSize)
  skipNodeFormats(cursor, paletteSize)
  skipNodeFormats(cursor, paletteSize)
  const fontFormats = readFontFormats(cursor, paletteSize)

  const symbols = []
  for (let i = 0; i < paletteSize; i++) {
    const full = cursor.readUInt16LE()
    const petite = cursor.readUInt16LE()
    const half = cursor.readUInt16LE()
    const quarter = cursor.readUInt16LE()
    const frenchKnot = cursor.readUInt16LE()
    const bead = cursor.readUInt16LE()
    symbols.push({
      full: full === 0xffff ? null : String.fromCharCode(full),
      petite: petite === 0xffff ? null : String.fromCharCode(petite),
      half: half === 0xffff ? null : String.fromCharCode(half),
      quarter: quarter === 0xffff ? null : String.fromCharCode(quarter),
      frenchKnot: frenchKnot === 0xffff ? null : String.fromCharCode(frenchKnot),
      bead: bead === 0xffff ? null : String.fromCharCode(bead),
    })
  }

  return { symbolFormats, fontFormats, symbols }
}

function parsePatternSettings(cursor) {
  const defaultStitchFont = cursor.readCString(FONT_NAME_LENGTH)
  cursor.skip(20)

  const printFont = {
    name: cursor.readCString(FONT_NAME_LENGTH),
    size: cursor.readUInt16LE(),
    weight: cursor.readUInt16LE(),
    italic: cursor.readUInt16LE() === 1,
  }
  cursor.skip(10)

  const view = cursor.readUInt16LE()
  const zoom = cursor.readUInt16LE()
  const showGrid = cursor.readUInt16LE() === 1
  const showRulers = cursor.readUInt16LE() === 1
  const showCenteringMarks = cursor.readUInt16LE() === 1
  const showFabricColorsWithSymbols = cursor.readUInt16LE() === 1
  cursor.skip(4)
  const gapsBetweenStitches = cursor.readUInt16LE() === 1

  const header = cursor.readCString(PAGE_HEADER_AND_FOOTER_LENGTH)
  const footer = cursor.readCString(PAGE_HEADER_AND_FOOTER_LENGTH)
  const margins = {
    left: cursor.readUInt16LE() / 100,
    right: cursor.readUInt16LE() / 100,
    top: cursor.readUInt16LE() / 100,
    bottom: cursor.readUInt16LE() / 100,
    header: cursor.readUInt16LE() / 100,
    footer: cursor.readUInt16LE() / 100,
  }
  const showPageNumbers = cursor.readUInt16LE() === 1
  const showAdjacentPageNumbers = cursor.readUInt16LE() === 1
  const centerChartOnPages = cursor.readUInt16LE() === 1
  cursor.skip(2)

  return {
    defaultStitchFont,
    printFont,
    view,
    zoom,
    showGrid,
    showRulers,
    showCenteringMarks,
    showFabricColorsWithSymbols,
    gapsBetweenStitches,
    printLayout: {
      header,
      footer,
      margins,
      showPageNumbers,
      showAdjacentPageNumbers,
      centerChartOnPages,
    },
  }
}

function readGridLineStyle(cursor) {
  const thickness = (cursor.readUInt16LE() * 72) / 1000
  cursor.skip(2)
  const color = cursor.readHexColor()
  cursor.skip(3)
  return { thickness, color }
}

function parseGrid(cursor) {
  const majorInterval = cursor.readUInt16LE()
  cursor.skip(2)
  const minorScreen = readGridLineStyle(cursor)
  const majorScreen = readGridLineStyle(cursor)
  const minorPrinter = readGridLineStyle(cursor)
  const majorPrinter = readGridLineStyle(cursor)
  cursor.skip(12)

  return {
    majorInterval,
    minorScreen,
    majorScreen,
    minorPrinter,
    majorPrinter,
  }
}

function parseFabric(cursor) {
  const fabricColorName = cursor.readCString(FABRIC_COLOR_NAME_LENGTH)
  const fabricColor = cursor.readHexColor()
  cursor.skip(65)

  cursor.readCString(40)
  cursor.readCString(40)
  cursor.readCString(40)
  cursor.readCString(200)
  cursor.readCString(2048)
  cursor.skip(6)
  const fabricKindName = cursor.readCString(40)
  cursor.skip(206)

  return {
    fabricColorName,
    fabricColor,
    fabricKindName,
  }
}

function parseStitchSettings(cursor) {
  const defaultStrands = {
    full: cursor.readUInt16LE(),
    half: cursor.readUInt16LE(),
    quarter: cursor.readUInt16LE(),
    back: cursor.readUInt16LE(),
    petite: cursor.readUInt16LE(),
    special: cursor.readUInt16LE(),
    straight: cursor.readUInt16LE(),
    frenchKnot: 2,
  }

  const displayThickness = Array.from({ length: 13 }, () => cursor.readUInt16LE() / 10)
  const outlinedStitches = cursor.readUInt16LE() === 1
  const useSpecifiedColor = cursor.readUInt16LE() === 1
  const outlineColorPercentage = cursor.readUInt16LE()
  let outlineColor = null

  if (useSpecifiedColor) {
    outlineColor = cursor.readHexColor()
    cursor.skip(1)
  } else {
    cursor.skip(4)
  }

  const outlineThickness = cursor.readUInt16LE() / 10

  return {
    defaultStrands,
    displayThickness,
    outlinedStitches,
    stitchOutline: {
      color: outlineColor,
      colorPercentage: outlineColorPercentage,
      thickness: outlineThickness,
    },
  }
}

function parseSymbolSettings(cursor) {
  const screenSpacing = [cursor.readUInt16LE(), cursor.readUInt16LE()]
  const printerSpacing = [cursor.readUInt16LE(), cursor.readUInt16LE()]
  const scaleUsingMaximumFontWidth = cursor.readUInt16LE() === 1
  const scaleUsingFontHeight = cursor.readUInt16LE() === 1
  const smallStitchSize = cursor.readUInt16LE()
  const showStitchColor = cursor.readUInt16LE() === 1
  const useLargeHalfStitchSymbol = cursor.readUInt16LE() === 1
  cursor.skip(6)
  const stitchSize = cursor.readUInt16LE()
  const useTrianglesBehindQuarterStitches = cursor.readUInt16LE() === 1
  const drawSymbolsOverBackstitches = cursor.readUInt16LE() === 1
  cursor.skip(2)

  return {
    screenSpacing,
    printerSpacing,
    scaleUsingMaximumFontWidth,
    scaleUsingFontHeight,
    smallStitchSize,
    showStitchColor,
    useLargeHalfStitchSymbol,
    stitchSize,
    useTrianglesBehindQuarterStitches,
    drawSymbolsOverBackstitches,
  }
}

export function deriveXsdDisplayPreset(displayMeta) {
  if (!displayMeta) return null

  const renderMode = displayMeta.view === 2 ? 'solid' : (displayMeta.view === 0 ? 'cross' : 'mixed')
  const cellType = renderMode === 'solid' ? 'full' : (renderMode === 'mixed' ? 'mixed' : 'x')
  const majorStep = Math.max(1, Number(displayMeta.grid?.majorInterval || 10))
  const minorWidth = displayMeta.showGrid === false ? 0 : 1
  const majorWidth = displayMeta.showGrid === false ? 0 : Math.max(minorWidth + 1, 2)
  const gapPixels = displayMeta.gapsBetweenStitches
    ? Math.max(1, Number(displayMeta.symbolSettings?.screenSpacing?.[0] || 1))
    : 0

  return {
    opacity: 1,
    cellType,
    displayMode: displayMeta.showFabricColorsWithSymbols ? 'both' : 'grid',
    borderWidth: displayMeta.showGrid === false ? 0 : 1,
    gridBackgroundVisible: !!displayMeta.showFabricColorsWithSymbols,
    fillEmptyWithWhite: !!displayMeta.showFabricColorsWithSymbols,
    renderStyle: {
      renderMode,
      previewMode: 'real',
      gapPixels,
      outlined: !!displayMeta.stitchSettings?.outlinedStitches,
      outlineColor: displayMeta.stitchSettings?.stitchOutline?.color || null,
      outlineColorPercentage: Number(displayMeta.stitchSettings?.stitchOutline?.colorPercentage || 80),
      outlineThickness: Number(displayMeta.stitchSettings?.stitchOutline?.thickness || 0.2),
    },
    gridStyle: {
      color: displayMeta.grid?.minorScreen?.color || '#000000',
      width: minorWidth,
      opacity: displayMeta.showGrid === false ? 0 : 1,
      majorColor: displayMeta.grid?.majorScreen?.color || displayMeta.grid?.minorScreen?.color || '#000000',
      majorWidth,
      majorStep,
      layer: renderMode === 'solid' ? 'overlay' : 'underlay',
    },
    canvasBackgroundColor: displayMeta.fabric?.fabricColor || '#ffffff',
  }
}

export function parseXsdDisplayBuffer(input) {
  let buffer

  if (input instanceof ArrayBuffer) {
    buffer = Buffer.from(input)
  } else if (ArrayBuffer.isView(input)) {
    buffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength)
  } else if (Buffer.isBuffer(input)) {
    buffer = input
  } else {
    throw new Error('Unsupported XSD buffer input')
  }

  const cursor = new BinaryCursor(buffer)
  const signature = cursor.readUInt16LE()
  if (signature !== VALID_SIGNATURE) {
    throw new Error(`Invalid XSD signature: ${signature}`)
  }

  cursor.skip(4)
  const version = [
    cursor.readUInt16LE(),
    cursor.readUInt16LE(),
    cursor.readUInt16LE(),
    cursor.readUInt16LE(),
  ]

  cursor.skip(727)

  const patternWidth = cursor.readUInt16LE()
  const patternHeight = cursor.readUInt16LE()
  cursor.readUInt32LE() // small stitches count
  cursor.readUInt16LE() // joints count
  const stitchesPerInch = [cursor.readUInt16LE(), cursor.readUInt16LE()]
  cursor.skip(6)

  const palette = parsePalette(cursor)
  const { symbolFormats, fontFormats, symbols } = parseFormatsAndSymbols(cursor, palette.paletteSize)
  const patternSettings = parsePatternSettings(cursor)
  const grid = parseGrid(cursor)
  const fabric = parseFabric(cursor)
  const stitchSettings = parseStitchSettings(cursor)
  const symbolSettings = parseSymbolSettings(cursor)

  const paletteItems = palette.items.map((item, index) => ({
    ...item,
    symbol: symbols[index] || null,
    font: fontFormats[index] || null,
    symbolFormat: symbolFormats[index] || null,
  }))

  return {
    version,
    patternWidth,
    patternHeight,
    stitchesPerInch,
    paletteSize: palette.paletteSize,
    defaultStitchFont: patternSettings.defaultStitchFont,
    view: patternSettings.view,
    zoom: patternSettings.zoom,
    showGrid: patternSettings.showGrid,
    showRulers: patternSettings.showRulers,
    showCenteringMarks: patternSettings.showCenteringMarks,
    showFabricColorsWithSymbols: patternSettings.showFabricColorsWithSymbols,
    gapsBetweenStitches: patternSettings.gapsBetweenStitches,
    grid,
    fabric,
    stitchSettings,
    symbolSettings,
    palette: paletteItems,
    printLayout: patternSettings.printLayout,
  }
}

export async function parseXsdDisplayMetadata(input) {
  if (typeof input?.arrayBuffer === 'function') {
    return parseXsdDisplayBuffer(await input.arrayBuffer())
  }
  return parseXsdDisplayBuffer(input)
}
