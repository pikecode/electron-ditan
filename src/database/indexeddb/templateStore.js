/**
 * Template metadata (templates) + binary payloads (template_blobs), aligned with schema.js
 */
import { DB_NAME, DB_VERSION, STORES, upgrade } from './schema.js'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      upgrade(request.result, e.oldVersion, e.newVersion)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function base64ToBlob(b64) {
  try {
    const arr = b64.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    const u8 = new Uint8Array(bstr.length)
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i)
    return new Blob([u8], { type: mime })
  } catch {
    return null
  }
}

/** @returns {Promise<object[]>} */
export async function listTemplates() {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORES.TEMPLATES)) return []
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TEMPLATES, 'readonly')
    const req = tx.objectStore(STORES.TEMPLATES).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

/** Alias expected by older call sites */
export const listTemplatesFn = listTemplates

/**
 * @param {string} id
 * @returns {Promise<{ id: string, blob: Blob } | null>}
 */
export async function getTemplateBlob(id) {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORES.TEMPLATE_BLOBS)) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TEMPLATE_BLOBS, 'readonly')
    const req = tx.objectStore(STORES.TEMPLATE_BLOBS).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * @param {object} record — keyPath id
 * @returns {Promise<object>}
 */
export async function addTemplate(record) {
  if (!record || !record.id) throw new Error('addTemplate: record.id required')
  const db = await openDB()
  const names = [STORES.TEMPLATES]
  if (db.objectStoreNames.contains(STORES.TEMPLATE_BLOBS)) names.push(STORES.TEMPLATE_BLOBS)
  const templateRecord = { ...record }
  const explicitBlob = templateRecord.blob instanceof Blob ? templateRecord.blob : null
  delete templateRecord.blob
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite')
    tx.oncomplete = () => resolve(templateRecord)
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORES.TEMPLATES).put(templateRecord)
    if (db.objectStoreNames.contains(STORES.TEMPLATE_BLOBS)) {
      const blob = explicitBlob || (templateRecord.base64 ? base64ToBlob(templateRecord.base64) : null)
      if (blob) tx.objectStore(STORES.TEMPLATE_BLOBS).put({ id: record.id, blob })
    }
  })
}

/**
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteTemplate(id) {
  const db = await openDB()
  const names = [STORES.TEMPLATES]
  if (db.objectStoreNames.contains(STORES.TEMPLATE_BLOBS)) names.push(STORES.TEMPLATE_BLOBS)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite')
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORES.TEMPLATES).delete(id)
    if (db.objectStoreNames.contains(STORES.TEMPLATE_BLOBS)) {
      tx.objectStore(STORES.TEMPLATE_BLOBS).delete(id)
    }
  })
}

/** @returns {Promise<object[]>} — full list; TemplateManager slices client-side */
export async function listTemplatesPaged(/* limit kept for API compat */) {
  return listTemplates()
}
