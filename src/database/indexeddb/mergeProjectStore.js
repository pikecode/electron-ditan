import { DB_NAME, DB_VERSION, STORES, upgrade } from './schema.js'

let dbPromise = null
function openDB(){
  if(dbPromise) return dbPromise
  dbPromise = new Promise((res,rej)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => upgrade(req.result, e.oldVersion, e.newVersion)
    req.onsuccess = ()=>res(req.result)
    req.onerror = ()=>rej(req.error)
  })
  return dbPromise
}
function withStore(mode, fn){
  return openDB().then(db=> new Promise((res,rej)=>{
    const tx = db.transaction(STORES.MERGE_PROJECTS, mode)
    const st = tx.objectStore(STORES.MERGE_PROJECTS)
    let r
    try { r = fn(st, tx) } catch(e){ rej(e); return }
    tx.oncomplete = async ()=>{ try { res(await r) } catch(e){ rej(e) } }
    tx.onerror = ()=>rej(tx.error)
  }))
}
function wrap(req){ return new Promise((res,rej)=>{ req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error) }) }

// record shape suggestion:
// { id, name, created_at, updated_at, pixel_width, pixel_height, grid_rows, grid_cols, project_ref_id?, project_uuid?, template_id?, template_resize:{fitMode:'fit', scale:1, target_w, target_h},
//   project_images:{ full, x }, palette, cells:{ rows, cols, data:[] }, status:'draft|done', meta:{} }

export async function addMergeProject(data){
  const now = new Date().toISOString()
  const rec = {
    name: data.name || '合图',
    created_at: now,
    updated_at: now,
    pixel_width: data.pixel_width,
    pixel_height: data.pixel_height,
    grid_rows: data.grid_rows,
    grid_cols: data.grid_cols,
    project_ref_id: data.project_ref_id || null,
    project_uuid: data.project_uuid || null,
    template_id: data.template_id || null,
    template_resize: data.template_resize || null,
    project_images: data.project_images || null,
    palette: data.palette || null,
    cells: data.cells || null,
    status: data.status || 'draft',
    meta: data.meta || {}
  }
  return withStore('readwrite', st => wrap(st.add(rec)))
}
export async function updateMergeProject(id, partial){
  return withStore('readwrite', async st => {
    const cur = await wrap(st.get(id))
    if(!cur) throw new Error('not found')
    const upd = { ...cur, ...partial, updated_at:new Date().toISOString() }
    await wrap(st.put(upd))
    return upd
  })
}
export async function getMergeProject(id){ return withStore('readonly', st => wrap(st.get(id))) }
export async function listMergeProjects(){ return withStore('readonly', st => wrap(st.getAll())) }
export async function deleteMergeProject(id){ return withStore('readwrite', st => wrap(st.delete(id))) }
export async function clearMergeProjects(){ return withStore('readwrite', st => wrap(st.clear())) }
