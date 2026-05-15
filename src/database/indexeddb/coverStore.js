import { DB_NAME, DB_VERSION, STORES, upgrade } from './schema.js'
import { resolveTextFontFamily } from '@/core/textLayout.js'

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
function tx(storeName, mode, fn){
  return openDB().then(db=> new Promise((res,rej)=>{
    const t = db.transaction(storeName, mode)
    const st = t.objectStore(storeName)
    let r
    try { r = fn(st, t) } catch(e){ rej(e); return }
    t.oncomplete = async ()=>{ try { res(await r) } catch(e){ rej(e) } }
    t.onerror = ()=>rej(t.error)
  }))
}
function wrap(req){ return new Promise((res,rej)=>{ req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error) }) }

// Cover meta shape (v9+):
// { id, name, created_at, updated_at, front_blob_id, back_blob_id, front_mime, back_mime, placements: Placement[] }
// Placement: { id, side:'front'|'back', type:'effect'|'grid'|'table'|'text', x, y, width, height, rotation?, text?, fontSize?, color?, fontFamily?, align? }
// Blob shape in COVER_BLOBS:
// { id, cover_id, kind: 'front'|'back', mime, blob }

async function putBlob(coverId, kind, file){
  if(!file) return null
  const id = `${coverId}_${kind}` // deterministic id so overwrite works
  const rec = { id, cover_id: coverId, kind, mime: file.type || guessMime(file.name), blob: file }
  await tx(STORES.COVER_BLOBS,'readwrite', st => st.put(rec))
  return id
}
function guessMime(name){
  const lower = name.toLowerCase()
  if(lower.endsWith('.png')) return 'image/png'
  if(lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}
function validateFile(file){
  if(!file) return
  const mime = file.type || guessMime(file.name)
  if(mime !== 'image/png' && mime !== 'image/jpeg') throw new Error('仅支持 PNG / JPEG')
}

function resolveTextAlign(value){
  const align = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['left', 'center', 'right'].includes(align) ? align : 'left'
}

// ---- Helpers: placements ----
function normalizePlacements(arr){
  if(!Array.isArray(arr)) return []
  const allowedTypes = ['effect','grid','table','text']
  return arr
    .filter(p=>p && typeof p === 'object')
    .map(p=>{
      const type = allowedTypes.includes(p.type) ? p.type : 'effect'
      const rotation = Number.isFinite(+p.rotation)
        ? ((+p.rotation % 360) + 360) % 360
        : 0
      const base = {
        id: p.id || `${p.side||'front'}-${type}`,
        side: p.side === 'back' ? 'back' : 'front',
        type,
        x: Number.isFinite(+p.x) ? +p.x : 0,
        y: Number.isFinite(+p.y) ? +p.y : 0,
        width: Number.isFinite(+p.width) ? +p.width : 0,
        height: Number.isFinite(+p.height) ? +p.height : 0,
        rotation,
      }
      // 文字占位：保留文字内容 / 字号 / 颜色 / 字体 / 对齐
      if(type === 'text'){
        base.text = typeof p.text === 'string' ? p.text : ''
        base.fontSize = Number.isFinite(+p.fontSize) ? +p.fontSize : 32
        base.color = typeof p.color === 'string' ? p.color : '#000000'
        base.fontFamily = resolveTextFontFamily(p.fontFamily)
        base.align = resolveTextAlign(p.align)
      }
      return base
    })
}

function placementTypeLabel(type){
  if(type === 'grid') return '格子图'
  if(type === 'table') return '表格'
  return type
}

function getMissingBackPlacementTypes(placements){
  const backTypes = new Set(
    (placements || [])
      .filter(p => p?.side === 'back')
      .map(p => p.type)
  )
  return ['grid', 'table'].filter(type => !backTypes.has(type))
}

function validateRequiredBackPlacements(placements, hasBackImage){
  const safePlacements = normalizePlacements(placements)
  if(!hasBackImage) return safePlacements
  const missingTypes = getMissingBackPlacementTypes(safePlacements)
  if(!missingTypes.length) return safePlacements
  throw new Error(`背面图已配置，但缺少背面${missingTypes.map(placementTypeLabel).join('、')}区域`)
}

export async function addCover({ name, frontFile, backFile, placements = [] }){
  if(!name || !name.trim()) throw new Error('名称不能为空')
  validateFile(frontFile); validateFile(backFile)
  const now = new Date().toISOString()
  const normPlacements = validateRequiredBackPlacements(placements, !!backFile)
  const coverId = await tx(STORES.COVERS,'readwrite', st => {
  const rec = { name: name.trim(), created_at: now, updated_at: now, front_blob_id: null, back_blob_id: null, front_mime: null, back_mime: null, placements: normPlacements }
    return wrap(st.add(rec))
  })
  let frontId=null, backId=null
  if(frontFile){ frontId = await putBlob(coverId,'front',frontFile) }
  if(backFile){ backId = await putBlob(coverId,'back',backFile) }
  if(frontId || backId){
    await tx(STORES.COVERS,'readwrite', st => {
      const getReq = st.get(coverId)
      getReq.onsuccess = ()=>{
        const rec = getReq.result
        if(frontId){ rec.front_blob_id = frontId; rec.front_mime = frontFile.type || guessMime(frontFile.name) }
        if(backId){ rec.back_blob_id = backId; rec.back_mime = backFile.type || guessMime(backFile.name) }
        st.put(rec)
      }
    })
  }
  return coverId
}

export async function updateCover(id, { name, frontFile, backFile, placements }){
  // 重写：避免在同一个事务回调里使用 await，防止事务提前结束导致挂起
  validateFile(frontFile); validateFile(backFile)
  const now = new Date().toISOString()
  const rec = await getCover(id)
  if(!rec) throw new Error('封面不存在')
  if(name) rec.name = name.trim()
  rec.updated_at = now
  // 先写入新的 blobs（独立事务），再一次性更新 meta
  if(frontFile){
    const fid = await putBlob(id,'front', frontFile)
    rec.front_blob_id = fid
    rec.front_mime = frontFile.type || guessMime(frontFile.name)
  }
  if(backFile){
    const bid = await putBlob(id,'back', backFile)
    rec.back_blob_id = bid
    rec.back_mime = backFile.type || guessMime(backFile.name)
  }
  const nextPlacements = placements ?? rec.placements ?? []
  rec.placements = validateRequiredBackPlacements(nextPlacements, !!rec.back_blob_id)
  await tx(STORES.COVERS,'readwrite', st => st.put(rec))
  return rec
}

export async function deleteCover(id){
  // delete blobs then cover
  const blobs = await listCoverBlobs(id)
  await tx(STORES.COVER_BLOBS,'readwrite', st => { blobs.forEach(b=> st.delete(b.id)) })
  await tx(STORES.COVERS,'readwrite', st => st.delete(id))
  return true
}

export async function listCovers(){
  const arr = await tx(STORES.COVERS,'readonly', st => wrap(st.getAll()))
  // backfill placements for old records
  arr.forEach(r=>{ if(!Array.isArray(r.placements)) r.placements = [] })
  return arr
}

export async function getCover(id){
  const rec = await tx(STORES.COVERS,'readonly', st => wrap(st.get(id)))
  if(rec && !Array.isArray(rec.placements)) rec.placements = []
  return rec
}

export async function getCoverImages(id){
  const cover = await getCover(id)
  if(!cover) return null
  const images = {}
  if(cover.front_blob_id){ images.front = await getBlob(cover.front_blob_id) }
  if(cover.back_blob_id){ images.back = await getBlob(cover.back_blob_id) }
  return { cover, ...images }
}

export async function updatePlacements(id, placements){
  if(!Array.isArray(placements)) throw new Error('placements 必须是数组')
  const now = new Date().toISOString()
  return tx(STORES.COVERS,'readwrite', st => new Promise((resolve,reject)=>{
    const getReq = st.get(id)
    getReq.onsuccess = ()=>{
      const rec = getReq.result
      if(!rec){ reject(new Error('封面不存在')); return }
      // 统一通过 normalizePlacements 做一次清洗，确保结构可被 IndexedDB 克隆
      const safePlacements = normalizePlacements(placements || [])
      rec.placements = validateRequiredBackPlacements(safePlacements, !!rec.back_blob_id)
      rec.updated_at = now
      st.put(rec)
      resolve(rec)
    }
    getReq.onerror = ()=>reject(getReq.error)
  }))
}

// ========== XML 导出/导入（占位，具体逻辑在 coverXml.js 中实现） ==========
export async function exportCoverToXml(id, coverToXml){
  const data = await getCoverImages(id)
  if(!data) throw new Error('封面不存在')
  if(typeof coverToXml !== 'function') throw new Error('coverToXml 必须是函数')
  // 读取 front/back blob -> dataURL
  async function blobToDataUrl(rec){ if(!rec?.blob) return null; return await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error); fr.readAsDataURL(rec.blob) }) }
  const frontDataUrl = await blobToDataUrl(data.front)
  const backDataUrl  = await blobToDataUrl(data.back)
  const cover = data.cover
  const payload = {
    id: cover.id,
    name: cover.name,
    created_at: cover.created_at,
    updated_at: cover.updated_at,
    placements: cover.placements || [],
    frontImage: frontDataUrl,
    backImage: backDataUrl
  }
  return coverToXml(payload)
}

export async function importCoverFromXml(xmlString, xmlToCover){
  if(typeof xmlToCover !== 'function') throw new Error('xmlToCover 必须是函数')
  const parsed = xmlToCover(xmlString)
  // parsed: { name, frontImage, backImage, placements }
  // dataURL -> File (临时)
  async function dataUrlToFile(dataUrl, filename){
    if(!dataUrl) return null
    // 手动解析 dataURL，避免 Electron 环境下 fetch(data:...) 报 Failed to fetch
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if(!match) throw new Error('无效的 dataURL 格式')
    const mime = match[1]
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    return new File([blob], filename, { type: mime })
  }
  const frontFile = await dataUrlToFile(parsed.frontImage, 'front.png')
  const backFile  = await dataUrlToFile(parsed.backImage, 'back.png')
  const newId = await addCover({ name: parsed.name || '导入封面', frontFile, backFile, placements: parsed.placements || [] })
  return newId
}

export async function getBlob(blobId){
  return tx(STORES.COVER_BLOBS,'readonly', st => wrap(st.get(blobId)))
}
export async function listCoverBlobs(coverId){
  return tx(STORES.COVER_BLOBS,'readonly', st => new Promise((resolve,reject)=>{
    const idxReq = st.index ? null : null // no composite index needed
    const req = st.getAll()
    req.onsuccess = ()=>{
      const all = req.result || []
      resolve(all.filter(r => r.cover_id === coverId))
    }
    req.onerror = ()=>reject(req.error)
  }))
}

export async function clearAllCovers(){
  await tx(STORES.COVER_BLOBS,'readwrite', st => st.clear())
  await tx(STORES.COVERS,'readwrite', st => st.clear())
}
