import { DB_NAME, DB_VERSION, STORES, upgrade } from './schema.js'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = request.result
      upgrade(db, e.oldVersion, e.newVersion)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function withStore(mode, callback) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, mode)
    const store = tx.objectStore(STORES.PROJECTS)
    let userPromise
    try {
      userPromise = callback(store, tx)
    } catch (e) {
      reject(e)
      return
    }
    tx.oncomplete = async () => {
      try {
        if (userPromise instanceof Promise) {
          const val = await userPromise
          resolve(val)
        } else {
          resolve(userPromise)
        }
      } catch (e) { reject(e) }
    }
    tx.onerror = () => reject(tx.error)
  })
}

function wrapRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function addProject(project) {
  // project 此时是 backend 格式；补充时间字段（使用 snake_case）
  const now = new Date().toISOString()
  if (!project.created_at && !project.createdAt) project.created_at = now
  if (!project.updated_at && !project.updatedAt) project.updated_at = project.created_at
  return withStore('readwrite', async store => {
    const id = await wrapRequest(store.add(project))
    return id
  })
}

export async function updateProject(id, partial) {
  return withStore('readwrite', async store => {
    const existing = await wrapRequest(store.get(id))
    if (!existing) throw new Error('Project not found')
    const updated = {
      ...existing,
      ...partial,
      // 统一使用 snake_case 保存
      created_at: existing.created_at || existing.createdAt || existing.created_at,
      updated_at: new Date().toISOString()
    }
    // 移除 camelCase 防止混乱
    delete updated.createdAt; delete updated.updatedAt
    await wrapRequest(store.put(updated))
    return updated
  })
}

export async function deleteProject(id) {
  return withStore('readwrite', store => wrapRequest(store.delete(id)))
}

export async function getProject(id) {
  return withStore('readonly', store => wrapRequest(store.get(id)))
}

export async function getAllProjects() {
  return withStore('readonly', store => wrapRequest(store.getAll()))
}

// 新的分页查询：利用 updated_at 索引 + 过滤 + 内存限制
export async function queryProjects({ keyword = '', offset = 0, limit = 6, order = 'desc' } = {}) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readonly')
    const store = tx.objectStore(STORES.PROJECTS)
    // 优先使用 updated_at 索引（没有则退回全量）
    const useIndex = store.indexNames.contains('updated_at') ? store.index('updated_at') : null

    const results = []
    const allMatchingKeys = [] // 仅收集匹配 key 统计 total
    const lowerKeyword = keyword ? keyword.toLowerCase() : ''

    const direction = order === 'desc' ? 'prev' : 'next'
    const source = useIndex || store
    let advanced = false
    const request = source.openCursor(null, direction)
    request.onsuccess = (e) => {
      const cursor = e.target.result
      if (!cursor) {
        resolve({ total: allMatchingKeys.length, items: results })
        return
      }
      const value = cursor.value
      const name = value.name || ''
      const uuid = value.uuid || ''
      let match = true
      if (lowerKeyword) {
        match = name.toLowerCase().includes(lowerKeyword) || uuid.toLowerCase().includes(lowerKeyword)
      }
      if (match) {
        allMatchingKeys.push(cursor.primaryKey)
        // 仅当落在分页窗口内才收集详细数据
        const idx = allMatchingKeys.length - 1
        if (idx >= offset && results.length < limit) {
          results.push(value)
        }
      }
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
}

export async function clearProjects() {
  return withStore('readwrite', store => wrapRequest(store.clear()))
}
