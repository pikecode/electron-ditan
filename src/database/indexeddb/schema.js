// Simplified IndexedDB schema
export const DB_NAME = 'easystitch_local'
// 升级说明:
// v8: 增加 xml snapshots store
// v9: 预留 cover 结构扩展 (placements 数组) — 不新增独立 store, 直接内嵌在 covers 记录中
//     若旧记录没有 placements 字段, 读取时补一个空数组
// v10: 增加 app_meta store，用于记录一次性初始化状态，避免空色卡库被错误自动补种
export const DB_VERSION = 10

export const STORES = {
  PROJECTS: 'projects',
  MERGE_PROJECTS: 'merge_projects', // snapshots
  COLOR_PALETTES: 'color_palettes',
  COLOR_GROUPS: 'color_groups',
  APP_META: 'app_meta',
  TEMPLATES: 'templates',
  TEMPLATE_BLOBS: 'template_blobs',
  // new cover management
  COVERS: 'covers',
  COVER_BLOBS: 'cover_blobs',
  XML_SNAPSHOTS: 'xml_snapshots'
}

// Create any missing object stores / indexes (idempotent per onupgradeneeded)
export function upgrade(db /*, oldVersion, newVersion */) {
  // projects
  if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
    const store = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id', autoIncrement: true })
    store.createIndex('uuid', 'uuid', { unique: true })
    store.createIndex('name', 'name', { unique: false })
    store.createIndex('createdAt', 'createdAt', { unique: false })
    store.createIndex('updatedAt', 'updatedAt', { unique: false })
    store.createIndex('created_at', 'created_at', { unique: false })
    store.createIndex('updated_at', 'updated_at', { unique: false })
  }

  // merge projects
  if (!db.objectStoreNames.contains(STORES.MERGE_PROJECTS)) {
    const m = db.createObjectStore(STORES.MERGE_PROJECTS, { keyPath: 'id', autoIncrement: true })
    m.createIndex('name', 'name', { unique: false })
    m.createIndex('created_at', 'created_at', { unique: false })
    m.createIndex('updated_at', 'updated_at', { unique: false })
    m.createIndex('grid_size', ['pixel_width','pixel_height'], { unique: false })
  }

  // color palettes
  if (!db.objectStoreNames.contains(STORES.COLOR_PALETTES)) {
    const paletteStore = db.createObjectStore(STORES.COLOR_PALETTES, { keyPath: 'id', autoIncrement: true })
    paletteStore.createIndex('hex_color', 'hex_color', { unique: false })
    paletteStore.createIndex('rgb_unique', ['rgb_r','rgb_g','rgb_b'], { unique: true })
  }

  // color groups
  if (!db.objectStoreNames.contains(STORES.COLOR_GROUPS)) {
    const groupStore = db.createObjectStore(STORES.COLOR_GROUPS, { keyPath: 'id', autoIncrement: true })
    groupStore.createIndex('name', 'name', { unique: false })
  }

  if (!db.objectStoreNames.contains(STORES.APP_META)) {
    db.createObjectStore(STORES.APP_META, { keyPath: 'key' })
  }

  // templates meta
  if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
    const tplStore = db.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' })
    tplStore.createIndex('name', 'name', { unique: false })
    tplStore.createIndex('uploadTime', 'uploadTime', { unique: false })
    tplStore.createIndex('format', 'format', { unique: false })
  }

  // template blobs
  if (!db.objectStoreNames.contains(STORES.TEMPLATE_BLOBS)) {
    db.createObjectStore(STORES.TEMPLATE_BLOBS, { keyPath: 'id' })
  }

  // covers meta
  if (!db.objectStoreNames.contains(STORES.COVERS)) {
    const coverStore = db.createObjectStore(STORES.COVERS, { keyPath: 'id', autoIncrement: true })
    coverStore.createIndex('name', 'name', { unique: false })
    coverStore.createIndex('created_at', 'created_at', { unique: false })
    coverStore.createIndex('updated_at', 'updated_at', { unique: false })
  }
  // v9 之前的记录里没有 placements 字段，这里不需要 schema 级别操作；
  // 读取时在业务层做默认值填充即可。

  // cover blobs (front/back images)
  if (!db.objectStoreNames.contains(STORES.COVER_BLOBS)) {
    const bs = db.createObjectStore(STORES.COVER_BLOBS, { keyPath: 'id' })
    bs.createIndex('cover_id', 'cover_id', { unique: false })
    bs.createIndex('kind', 'kind', { unique: false })
  }

  // xml snapshots
  if (!db.objectStoreNames.contains(STORES.XML_SNAPSHOTS)) {
    const xmlStore = db.createObjectStore(STORES.XML_SNAPSHOTS, { keyPath: 'saved_at' })
    xmlStore.createIndex('project_name', 'project_name', { unique: false })
    xmlStore.createIndex('saved_at', 'saved_at', { unique: true })
  }
}
