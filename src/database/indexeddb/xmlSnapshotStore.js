import { DB_NAME, DB_VERSION, STORES, upgrade } from './schema.js'

let dbPromise = null
function openDB(){
  if(dbPromise) return dbPromise
  dbPromise = new Promise((res,rej)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => upgrade(req.result, e.oldVersion, e.newVersion)
    req.onsuccess = ()=> res(req.result)
    req.onerror = ()=> rej(req.error)
  })
  return dbPromise
}
function tx(storeName, mode, fn){
  return openDB().then(db => new Promise((res,rej)=>{
    const t = db.transaction(storeName, mode)
    const st = t.objectStore(storeName)
    let p
    try { p = fn(st, t) } catch(e){ rej(e); return }
    t.oncomplete = async ()=> { try { res(await p) } catch(e){ rej(e) } }
    t.onerror = ()=> rej(t.error)
  }))
}
function wrap(req){ return new Promise((res,rej)=>{ req.onsuccess = ()=> res(req.result); req.onerror = ()=> rej(req.error) }) }

// shape: { saved_at: ISOString, project_name, rows, cols, palette_count, xml_size, xml_string }
export async function saveXmlSnapshot({ project_name, rows, cols, palette_count, xml_string }) {
  const saved_at = new Date().toISOString()
  const rec = {
    saved_at,
    project_name: project_name || 'Project',
    rows: rows ?? null,
    cols: cols ?? null,
    palette_count: palette_count ?? null,
    xml_size: typeof xml_string === 'string' ? xml_string.length : 0,
    xml_string
  }
  return tx(STORES.XML_SNAPSHOTS, 'readwrite', st => wrap(st.add(rec)))
}
export async function getXmlSnapshot(saved_at){
  return tx(STORES.XML_SNAPSHOTS, 'readonly', st => wrap(st.get(saved_at)))
}
export async function listXmlSnapshots(){
  return tx(STORES.XML_SNAPSHOTS, 'readonly', st => wrap(st.getAll()))
}
export async function deleteXmlSnapshot(saved_at){
  return tx(STORES.XML_SNAPSHOTS, 'readwrite', st => wrap(st.delete(saved_at)))
}
export async function clearXmlSnapshots(){
  return tx(STORES.XML_SNAPSHOTS, 'readwrite', st => wrap(st.clear()))
}
