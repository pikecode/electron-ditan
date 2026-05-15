// Centralized constants for Cover Compose feature
// NOTE: These values encapsulate layout heuristics so future tuning only changes here.
// All modules should import from this file instead of hardcoding numbers.

// Merge (front composite image) -------------------------------------------------
// Base width used when no cover size context yet (e.g. only merged image present)
export const MERGE_BASE_WIDTH = 600;
// When cover size is known we try to fit merged image to a ratio of cover width.
// 0.62 chosen empirically to keep image dominant but leave room for title text.
export const MERGE_WIDTH_RATIO_ON_COVER = 0.62; // meaning: target merged display width = coverWidth * 0.62
// Fallback larger variant sometimes used previously (850). Keep for compatibility toggles if needed.
export const MERGE_LARGE_WIDTH_RATIO_ON_COVER = 0.85; // not default; legacy behavior
// Position ratios (anchor top-left of merged image relative to cover)
export const MERGE_POS_X_RATIO = 0.60; // meaning: merged.x = coverWidth  * 0.60
export const MERGE_POS_Y_RATIO = 0.30; // meaning: merged.y = coverHeight * 0.30
// Scale limits for interactive zoom
export const MERGE_MIN_SCALE = 0.05;
export const MERGE_MAX_SCALE = 4;

// Grid (back side) --------------------------------------------------------------
// Margin kept around grid when fitting to cover height
export const GRID_VERTICAL_MARGIN = 40; // effective subtract from cover height before scaling
export const GRID_MIN_SCALE = 0.2;
export const GRID_MAX_SCALE = 10;

// Table (back side) -------------------------------------------------------------
// Table target height ratio relative to cover height
export const TABLE_TARGET_HEIGHT_RATIO = 0.50; // 50% of cover height
// Table top offset positioning (pixels from top)
export const TABLE_TOP_OFFSET = 50; // meaning: table.y = 50
export const TABLE_MIN_SCALE = 0.2;
export const TABLE_MAX_SCALE = 10;
export const TABLE_MIN_COLUMNS = 1;
export const TABLE_MAX_COLUMNS = 3;

// Text --------------------------------------------------------------------------
export const TEXT_DEFAULT_FONT_SIZE = 120; // large title style
export const TEXT_MIN_FONT_SIZE = 8;
export const TEXT_MAX_FONT_SIZE = 500;
// Initial text content
export const FRONT_TEXT_DEFAULT = '标题';
export const BACK_TEXT_DEFAULT = '背面文字';

// Brush / Strokes --------------------------------------------------------------
export const BRUSH_MIN_SIZE = 1;
export const BRUSH_MAX_SIZE = 120;
export const BRUSH_DEFAULT_SIZE = 8;
export const BRUSH_DEFAULT_COLOR = '#ff0000';

// Persistence ------------------------------------------------------------------
export const PERSIST_DEBOUNCE_MS = 300; // design save debounce

// Debug flag (can be toggled later or wired to settings)
export const MERGE_DEBUG = true; // keep console logs for now as requested

// Export -----------------------------------------------------------------------
export const EXPORT_DEFAULT_FORMAT = 'png';

// Utility freeze (optional) to prevent accidental mutation at runtime
export const MergeConstants = Object.freeze({
  MERGE_BASE_WIDTH,
  MERGE_WIDTH_RATIO_ON_COVER,
  MERGE_LARGE_WIDTH_RATIO_ON_COVER,
  MERGE_POS_X_RATIO,
  MERGE_POS_Y_RATIO,
  MERGE_MIN_SCALE,
  MERGE_MAX_SCALE,
  GRID_VERTICAL_MARGIN,
  GRID_MIN_SCALE,
  GRID_MAX_SCALE,
  TABLE_TARGET_HEIGHT_RATIO,
  TABLE_TOP_OFFSET,
  TABLE_MIN_SCALE,
  TABLE_MAX_SCALE,
  TABLE_MIN_COLUMNS,
  TABLE_MAX_COLUMNS,
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_MIN_FONT_SIZE,
  TEXT_MAX_FONT_SIZE,
  FRONT_TEXT_DEFAULT,
  BACK_TEXT_DEFAULT,
  BRUSH_MIN_SIZE,
  BRUSH_MAX_SIZE,
  BRUSH_DEFAULT_SIZE,
  BRUSH_DEFAULT_COLOR,
  PERSIST_DEBOUNCE_MS,
  MERGE_DEBUG,
  EXPORT_DEFAULT_FORMAT
});
