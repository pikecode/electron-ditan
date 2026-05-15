import { DB_NAME, DB_VERSION, STORES, upgrade } from './schema.js'

const COLOR_PALETTES_INIT_META_KEY = 'color_palettes_initialized_v1'

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
}

async function readMeta(db, key) {
  if (!db.objectStoreNames.contains(STORES.APP_META)) return null
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.APP_META, 'readonly')
    const rq = tx.objectStore(STORES.APP_META).get(key)
    rq.onsuccess = () => resolve(rq.result || null)
    rq.onerror = () => reject(rq.error)
  })
}

async function writeMeta(db, key, value) {
  if (!db.objectStoreNames.contains(STORES.APP_META)) return
  const now = new Date().toISOString()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.APP_META, 'readwrite')
    const rq = tx.objectStore(STORES.APP_META).put({ key, value, updated_at: now })
    rq.onsuccess = () => resolve()
    rq.onerror = () => reject(rq.error)
  })
}

async function countColorPalettesRaw(db) {
  if (!db.objectStoreNames.contains(STORES.COLOR_PALETTES)) return
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.COLOR_PALETTES, 'readonly')
    const rq = tx.objectStore(STORES.COLOR_PALETTES).count()
    rq.onsuccess = () => resolve(rq.result)
    rq.onerror = () => reject(rq.error)
  })
}

async function ensureColorPalettesInitialized(db) {
  const meta = await readMeta(db, COLOR_PALETTES_INIT_META_KEY)
  if (meta?.value) return false

  const paletteCount = await countColorPalettesRaw(db)
  if (paletteCount > 0) {
    await writeMeta(db, COLOR_PALETTES_INIT_META_KEY, true)
    return false
  }

  // Fresh install should start with an empty palette library.
  // We only mark initialization complete so later opens do not auto-seed defaults.
  await writeMeta(db, COLOR_PALETTES_INIT_META_KEY, true)
  return false
}

let dbPromise = null
function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      upgrade(req.result, e.oldVersion, e.newVersion)
    }
    req.onsuccess = () => {
      const db = req.result
      ensureColorPalettesInitialized(db)
        .then(() => resolve(db))
        .catch(err => {
          console.error('[IndexedDB] initialize palettes failed', err)
          resolve(db)
        })
    }
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function wrap(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) }) }
async function txStore(storeName, mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    let p
    try { p = fn(store, tx) } catch (e) { reject(e); return }
    tx.oncomplete = async () => { try { resolve(await p) } catch (e) { reject(e) } }
    tx.onerror = () => reject(tx.error)
  })
}

async function txStores(storeNames, mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode)
    const stores = Object.fromEntries(storeNames.map(name => [name, tx.objectStore(name)]))
    let p
    try { p = fn(stores, tx) } catch (e) { reject(e); return }
    tx.oncomplete = async () => { try { resolve(await p) } catch (e) { reject(e) } }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
  })
}

// Color Palettes ==============================================================
export async function getAllColorPalettes() {
  return await txStore(STORES.COLOR_PALETTES, 'readonly', store => wrap(store.getAll()))
}

export async function addColorPalette(color) {
  // uniqueness check for (r,g,b)
  const existingPalette = await findColorByRGB(color.rgb_r, color.rgb_g, color.rgb_b)
  if (existingPalette) throw new Error(`Color with RGB(${color.rgb_r},${color.rgb_g},${color.rgb_b}) already exists`)
  const now = new Date().toISOString()
  color.created_at = now
  color.updated_at = now
  return txStore(STORES.COLOR_PALETTES, 'readwrite', async store => {
    // collect existing ids
    const all = await wrap(store.getAll())
    const used = new Set(all.map(c => c.id))
    let newId = 1
    while (used.has(newId)) newId++ // smallest unused positive integer
    color.id = newId
    await wrap(store.add(color))
    return { ...color }
  })
}

export async function deleteColorPalette(id) {
  return txStores([STORES.COLOR_PALETTES, STORES.COLOR_GROUPS], 'readwrite', async stores => {
    const paletteStore = stores[STORES.COLOR_PALETTES]
    const groupStore = stores[STORES.COLOR_GROUPS]
    const existing = await wrap(paletteStore.get(id))
    if (!existing) throw new Error('Color not found')
    await wrap(paletteStore.delete(id))

    const groups = await wrap(groupStore.getAll())
    for (const group of groups) {
      const colorIds = Array.isArray(group.color_ids) ? group.color_ids : []
      const nextColorIds = colorIds.filter(colorId => colorId !== id)
      if (nextColorIds.length === colorIds.length) continue
      group.color_ids = nextColorIds
      group.updated_at = new Date().toISOString()
      await wrap(groupStore.put(group))
    }

    const remainingCount = await wrap(paletteStore.count())
    return { deleted: true, remainingCount }
  })
}

export async function batchDeleteColorPalettes(ids) {
  return txStores([STORES.COLOR_PALETTES, STORES.COLOR_GROUPS], 'readwrite', async stores => {
    const paletteStore = stores[STORES.COLOR_PALETTES]
    const groupStore = stores[STORES.COLOR_GROUPS]
    const requestedIds = Array.from(new Set((Array.isArray(ids) ? ids : [])
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)))

    if (!requestedIds.length) {
      throw new Error('No valid color ids provided')
    }

    const deleteIdSet = new Set()
    const deleted = []
    const notFound = []

    for (const id of requestedIds) {
      const existing = await wrap(paletteStore.get(id))
      if (!existing) {
        notFound.push(id)
        continue
      }
      await wrap(paletteStore.delete(id))
      deleteIdSet.add(id)
      deleted.push(id)
    }

    if (deleteIdSet.size > 0) {
      const groups = await wrap(groupStore.getAll())
      for (const group of groups) {
        const colorIds = Array.isArray(group.color_ids) ? group.color_ids : []
        const nextColorIds = colorIds.filter(colorId => !deleteIdSet.has(colorId))
        if (nextColorIds.length === colorIds.length) continue
        group.color_ids = nextColorIds
        group.updated_at = new Date().toISOString()
        await wrap(groupStore.put(group))
      }
    }

    const remainingCount = await wrap(paletteStore.count())
    return { deleted, notFound, remainingCount }
  })
}

export async function findColorByRGB(r,g,b) {
  const all = await getAllColorPalettes()
  return all.find(c => c.rgb_r === r && c.rgb_g === g && c.rgb_b === b)
}

export async function getColorPaletteInternal(id) {
  return txStore(STORES.COLOR_PALETTES, 'readonly', store => wrap(store.get(id)))
}

export async function updateColorPaletteInternal(id, partial) {
  return txStore(STORES.COLOR_PALETTES, 'readwrite', async store => {
    const existing = await wrap(store.get(id))
    if (!existing) throw new Error('Color not found')
    const next = { ...existing, ...partial }
    const all = await wrap(store.getAll())
    const duplicate = all.find(c =>
      c.id !== id &&
      c.rgb_r === next.rgb_r &&
      c.rgb_g === next.rgb_g &&
      c.rgb_b === next.rgb_b
    )
    if (duplicate) {
      throw new Error(`Color with RGB(${next.rgb_r},${next.rgb_g},${next.rgb_b}) already exists`)
    }
    const updated = { ...existing, ...partial, updated_at: new Date().toISOString() }
    await wrap(store.put(updated))
    return updated
  })
}

// Color Groups ================================================================
export async function getAllColorGroups() {
  return txStore(STORES.COLOR_GROUPS, 'readonly', store => wrap(store.getAll()))
}

export async function addColorGroup(group) {
  const now = new Date().toISOString()
  group.created_at = now
  group.updated_at = now
  group.color_ids = group.color_ids || []
  const id = await txStore(STORES.COLOR_GROUPS, 'readwrite', store => wrap(store.add(group)))
  return { ...group, id }
}

export async function updateColorGroupInternal(id, partial) {
  return txStore(STORES.COLOR_GROUPS, 'readwrite', async store => {
    const existing = await wrap(store.get(id))
    if (!existing) throw new Error('Group not found')
    const updated = { ...existing, ...partial, updated_at: new Date().toISOString() }
    await wrap(store.put(updated))
    return updated
  })
}

export async function deleteColorGroupInternal(id) {
  return txStore(STORES.COLOR_GROUPS, 'readwrite', store => wrap(store.delete(id)))
}

export async function getColorGroupInternal(id) {
  return txStore(STORES.COLOR_GROUPS, 'readonly', store => wrap(store.get(id)))
}

export async function batchDeleteGroupsInternal(ids) {
  return txStore(STORES.COLOR_GROUPS, 'readwrite', async store => {
    const deleted = []
    const notFound = []
    for (const id of ids) {
      const g = await wrap(store.get(id))
      if (g) { await wrap(store.delete(id)); deleted.push(id) } else { notFound.push(id) }
    }
    return { deleted, notFound }
  })
}

// Cleanup color references in groups when a color is deleted
export async function removeColorFromAllGroups(colorId) {
  await txStore(STORES.COLOR_GROUPS, 'readwrite', async store => {
    const allReq = store.getAll()
    const all = await wrap(allReq)
    for (const g of all) {
      const filtered = (g.color_ids || []).filter(id => id !== colorId)
      if (filtered.length !== (g.color_ids || []).length) {
        g.color_ids = filtered
        g.updated_at = new Date().toISOString()
        await wrap(store.put(g))
      }
    }
  })
}

export async function countColorPalettes() {
  const db = await openDB()
  return await countColorPalettesRaw(db)
}

export async function replaceAllPalettesAndGroups(importColors, options = { preserveGroups: true }) {
  const { preserveGroups = true } = options || {}
  const db = await openDB()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.COLOR_GROUPS, STORES.COLOR_PALETTES], 'readwrite')
    const groupStore = tx.objectStore(STORES.COLOR_GROUPS)
    const paletteStore = tx.objectStore(STORES.COLOR_PALETTES)

    let oldPalettes = []
    let oldGroups = []

    const snapshotPromises = []
    if (preserveGroups) {
      snapshotPromises.push(new Promise((res, rej) => {
        const req = paletteStore.getAll(); req.onsuccess = () => { oldPalettes = req.result || []; res() }; req.onerror = () => rej(req.error)
      }))
      snapshotPromises.push(new Promise((res, rej) => {
        const req = groupStore.getAll(); req.onsuccess = () => { oldGroups = req.result || []; res() }; req.onerror = () => rej(req.error)
      }))
    }

    Promise.all(snapshotPromises).then(() => {
      if (!preserveGroups) {
        groupStore.clear() // original behavior when not preserving
      }
      paletteStore.clear()
      const now = new Date().toISOString()
      const seen = new Set()
      let inserted = 0, skipped = 0
      const rgbToNewId = new Map()

      importColors.forEach((c, idx) => {
        if (!c) { skipped++; return }
        const r = c.rgb?.r ?? c.rgb_r, g = c.rgb?.g ?? c.rgb_g, b = c.rgb?.b ?? c.rgb_b
        if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') { skipped++; return }
        const key = r + ',' + g + ',' + b
        if (seen.has(key)) { skipped++; return }
        seen.add(key)
        const hex = (c.hex || c.hex_color || rgbToHex(r, g, b)).toUpperCase()
        const obj = {
          id: idx + 1, // sequential id starting at 1
          name: (c.name && c.name.trim()) || 'unknown',
          rgb_r: r, rgb_g: g, rgb_b: b,
            hex_color: hex,
          protected: !!c.protected,
          created_at: c.created_at || now,
          updated_at: c.updated_at || now
        }
        try { paletteStore.add(obj); inserted++; rgbToNewId.set(key, obj.id) } catch (e) { skipped++ }
      })

      let remappedGroups = 0
      if (preserveGroups && oldGroups.length) {
        // build oldId -> rgbKey map
        const oldIdToRGBKey = new Map()
        oldPalettes.forEach(p => {
          const key = p.rgb_r + ',' + p.rgb_g + ',' + p.rgb_b
          oldIdToRGBKey.set(p.id, key)
        })
        for (const g of oldGroups) {
          const originalIds = Array.isArray(g.color_ids) ? g.color_ids : []
          const newIds = []
          for (const oldId of originalIds) {
            const rgbKey = oldIdToRGBKey.get(oldId)
            if (!rgbKey) continue
            const newId = rgbToNewId.get(rgbKey)
            if (newId) newIds.push(newId)
          }
          g.color_ids = newIds
          g.updated_at = now
          try { groupStore.put(g); remappedGroups++ } catch (e) { /* ignore */ }
        }
      }

      tx.oncomplete = () => resolve({ inserted, skipped, total: importColors.length, preserveGroups, remappedGroups })
      tx.onerror = () => reject(tx.error)
    }).catch(err => { reject(err) })
  })
}
