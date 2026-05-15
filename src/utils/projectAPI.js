/**
 * 项目管理API - 改为直接使用 IndexedDB (不再依赖 C++ / IPC)
 */
import { DB_NAME, DB_VERSION, STORES, upgrade } from '../database/indexeddb/schema.js'
import { buildPersistedXsdParsed } from './xsdProjectPersistence.js'

// UUID 生成
function generateUUID(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16)})}

// 打开 / 复用 DB
let dbPromise=null
function openIDB(){
  if(dbPromise) return dbPromise
  dbPromise = new Promise((resolve,reject)=>{
    let req
    try { req = indexedDB.open(DB_NAME, DB_VERSION) } catch(e){ reject(e); return }
    req.onupgradeneeded = e => { try { upgrade(req.result, e.oldVersion, e.newVersion) } catch(err){ console.error('[projectAPI] upgrade failed', err) } }
    req.onsuccess = ()=> resolve(req.result)
    req.onerror = ()=> reject(req.error)
  })
  return dbPromise
}

function tx(storeName, mode, fn){
  return openIDB().then(db=>new Promise((resolve,reject)=>{
    const t = db.transaction(storeName, mode)
    const s = t.objectStore(storeName)
    let p
    try { p = fn(s,t) } catch(e){ reject(e); return }
    t.oncomplete = ()=>{ Promise.resolve(p).then(resolve).catch(reject) }
    t.onerror = ()=> reject(t.error)
  }))
}
function wrap(req){ return new Promise((res,rej)=>{ req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error) }) }

// 清理 / 标准化表单数据 -> 存储结构
function normalizeProjectInput(data){
  const d = data || {}
  const img = d.image || {}
  const grid = d.grid || {}
  const colorCfg = d.colorConfig || {}
  const scopedCountColors = colorCfg.type === 'count' && Array.isArray(colorCfg.allColors)
    ? colorCfg.allColors
    : []
  const selectedColors = d.selected_colors !== undefined
    ? d.selected_colors
    : JSON.stringify(scopedCountColors.length ? scopedCountColors : (colorCfg.selectedColors || []))
  const processData = d.process_data !== undefined
    ? d.process_data
    : JSON.stringify(d.processData || {})
  const metadata = d.metadata !== undefined
    ? d.metadata
    : JSON.stringify(d.metadata || {})
  const cellsMatrix = d.cells_matrix !== undefined
    ? d.cells_matrix
    : JSON.stringify(d.cellsMatrix || [])
  const xsdParsed = d.xsd_parsed !== undefined
    ? d.xsd_parsed
    : d.xsdParsed
  // 分开保存缩略图与真原图，避免更新旧项目时把预览图反写成原图
  const thumb = d.image_thumbnail || img.thumbnail || img.data || img.base64 || ''
  const imageData = d.image_data || img.data || img.original || img.base64 || img.base64Data || img.base64_image || ''
  const now = new Date().toISOString()
  return {
    uuid: d.uuid || generateUUID(),
    name: d.name || `项目_${Date.now()}`,
    import_type: d.import_type || d.importType || (d.xsd_parsed || d.xsdParsed ? 'xsd' : 'image'),
    image_path: d.image_path || img.path || '',
    image_name: d.image_name || img.name || '',
    image_width: d.image_width || img.size?.width || img.width || 0,
    image_height: d.image_height || img.size?.height || img.height || 0,
    image_thumbnail: thumb,
    image_data: imageData,
    grid_length: d.grid_length || grid.length || 0,
    grid_width: d.grid_width || grid.width || 0,
    cell_size: d.cell_size || grid.cellSize || 1,
    color_type: d.color_type || colorCfg.type || 'count',
    color_group_id: d.color_group_id || colorCfg.colorGroupId || 0,
    color_count: d.color_count || colorCfg.colorCount || (colorCfg.selectedColors?.length) || 0,
    selected_colors: typeof selectedColors === 'string' ? selectedColors : JSON.stringify(selectedColors || []),
    process_data: typeof processData === 'string' ? processData : JSON.stringify(processData || {}),
    metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
    cells_matrix: typeof cellsMatrix === 'string' ? cellsMatrix : JSON.stringify(cellsMatrix || []),
    xsd_parsed: JSON.stringify(buildPersistedXsdParsed(xsdParsed)),
    created_at: d.created_at || now,
    updated_at: now
  }
}

export const projectAPI = {
  // 列表
  async getProjects(){
    try {
      const rows = await tx(STORES.PROJECTS,'readonly',store=>wrap(store.getAll()))
      // 排序 (最新更新时间靠前)
      rows.sort((a,b)=> (b.updated_at||'').localeCompare(a.updated_at||''))
      return { success:true, projects: rows }
    } catch(e){ console.error('getProjects failed', e); return { success:false, error:e.message, projects:[] } }
  },
  // 新增
  async addProject(formData){
    try {
      const rec = normalizeProjectInput(formData)
      const id = await tx(STORES.PROJECTS,'readwrite',store=>wrap(store.add(rec)))
      return { success:true, project: { id, ...rec } }
    } catch(e){ console.error('addProject failed', e); return { success:false, error:e.message } }
  },
  // 更新 (按 id 或 uuid)
  async updateProject(idOrUuid, partial){
    try {
      const updated = await tx(STORES.PROJECTS,'readwrite', async store => {
        // 先尝试通过数字主键
        let existing = null
        if (typeof idOrUuid === 'number') existing = await wrap(store.get(idOrUuid))
        if(!existing){
          // 通过 uuid 全表扫描 (数量通常不大)
            const all = await wrap(store.getAll())
            existing = all.find(p=>p.uuid===idOrUuid)
        }
        if(!existing) throw new Error('Project not found')
        const merged = { ...existing, ...partial, updated_at: new Date().toISOString() }
        await wrap(store.put(merged))
        return merged
      })
      return { success:true, data: updated }
    } catch(e){ console.error('updateProject failed', e); return { success:false, error:e.message } }
  },
  // 删除
  async deleteProject(idOrUuid){
    try {
      await tx(STORES.PROJECTS,'readwrite', async store => {
        if (typeof idOrUuid === 'number') { await wrap(store.delete(idOrUuid)); return }
        const all = await wrap(store.getAll())
        const hit = all.find(p=>p.uuid===idOrUuid)
        if (hit) await wrap(store.delete(hit.id))
      })
      return { success:true }
    } catch(e){ console.error('deleteProject failed', e); return { success:false, error:e.message } }
  },
  // 单个
  async getProjectById(idOrUuid){
    try {
      const proj = await tx(STORES.PROJECTS,'readonly', async store => {
        if (typeof idOrUuid === 'number') return await wrap(store.get(idOrUuid))
        const all = await wrap(store.getAll())
        return all.find(p=>p.uuid===idOrUuid) || null
      })
      return { success: !!proj, data: proj }
    } catch(e){ console.error('getProjectById failed', e); return { success:false, error:e.message, data:null } }
  },
  // 批量
  async batchOperation(ids, op){
    const results=[]
    for(const id of ids){
      if(op==='delete') results.push(await this.deleteProject(id))
      else results.push({ success:false, error:'Unknown op' })
    }
    return { success:true, results }
  }
}
