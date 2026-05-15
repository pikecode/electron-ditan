import { ref, computed } from 'vue'
import { addProject, updateProject as dbUpdate, deleteProject as dbDelete, getProject as dbGet, queryProjects } from '../database/indexeddb/projectStore.js'
import { validateProjectData, convertToBackendFormat, convertToFrontendFormat } from '../utils/projectDataConverter.js'
import { generateUUID } from '../utils/uuid.js'

// Wrap convertToBackendFormat -> convertToFrontendFormat to ensure schema consistency
function normalizeFrontend(data) {
  // We only need the frontend shape; convertToBackendFormat then back ensures fields completeness
  const backend = convertToBackendFormat(data)
  return convertToFrontendFormat({ id: data.id, uuid: data.uuid, ...backend })
}

function addCompatibilityShims(p){
  try {
    if (!p) return p
    if (p.image) {
      p.image_width = p.image_width || p.image.size?.width || 0
      p.image_height = p.image_height || p.image.size?.height || 0
      p.image_thumbnail = p.image_thumbnail || p.image.thumbnail || p.image.data || ''
      p.image_data = p.image_data || p.image.data || ''
    }
    if (p.grid) {
      p.grid_length = p.grid_length || p.grid.length || 0
      p.grid_width = p.grid_width || p.grid.width || 0
      p.cell_size = p.cell_size || p.grid.cellSize || 0
    }
    if (p.colorConfig) {
      p.color_type = p.color_type || p.colorConfig.type
      p.color_group_id = p.color_group_id || p.colorConfig.colorGroupId
      p.color_count = p.color_count || p.colorConfig.colorCount
      if (!p.selected_colors) {
        try {
          const scopedColors = p.colorConfig.type === 'count'
            ? (p.colorConfig.allColors || [])
            : (p.colorConfig.selectedColors || [])
          p.selected_colors = JSON.stringify(scopedColors)
        } catch {
          p.selected_colors = '[]'
        }
      }
    }
  } catch(e){ console.warn('addCompatibilityShims failed', e, p) }
  return p
}

function buildCreatedProjectRecord(record, { id, uuid, now }) {
  const imageThumbnail = record.image?.thumbnail || record.image?.data || ''
  const imageData = record.image?.data || ''
  return addCompatibilityShims({
    ...record,
    id,
    uuid,
    createdAt: now,
    updatedAt: now,
    image: record.image
      ? {
          ...record.image,
          thumbnail: imageThumbnail,
          data: imageData,
          size: {
            ...(record.image.size || {})
          }
        }
      : null,
    grid: record.grid
      ? {
          ...record.grid
        }
      : null,
    colorConfig: record.colorConfig
      ? {
          ...record.colorConfig,
          selectedColors: Array.isArray(record.colorConfig.selectedColors)
            ? record.colorConfig.selectedColors.map(color => ({ ...color }))
            : [],
          allColors: Array.isArray(record.colorConfig.allColors)
            ? record.colorConfig.allColors.map(color => ({ ...color }))
            : []
        }
      : null,
    result: record.result || {},
    cellsMatrix: Array.isArray(record.cellsMatrix) ? record.cellsMatrix : [],
    xsdParsed: record.xsdParsed || null
  })
}

export function useLocalProjects() {
  const projects = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pageSize = 6
  const currentPage = ref(1)
  const total = ref(0)
  const searchKeyword = ref('')
  const selectedProjectId = ref(null)
  const order = ref('desc') // 时间排序 desc/asc

  async function loadPage(page = 1) {
    loading.value = true
    error.value = null
    try {
      const offset = (page - 1) * pageSize
      const { items, total: t } = await queryProjects({ keyword: searchKeyword.value, offset, limit: pageSize, order: order.value })
      const converted = []
      for (const raw of items) {
        try { const front = convertToFrontendFormat(raw); if (front) converted.push(addCompatibilityShims(front)) } catch(e){ console.warn('转换项目数据失败:', e, raw) }
      }
      projects.value = converted
      total.value = t
      currentPage.value = page
    } catch (e) { error.value = e.message } finally { loading.value = false }
  }

  async function search(keyword) {
    searchKeyword.value = keyword || ''
    await loadPage(1)
  }

  async function create(projectData) {
    try {
      const validation = validateProjectData({ ...projectData })
      if (!validation.isValid) return { success: false, error: validation.errors.join(', ') }
      const uuid = generateUUID()
      const now = new Date().toISOString()
      const record = { ...projectData, uuid, result: projectData.result || {}, createdAt: now, updatedAt: now }
      const backend = convertToBackendFormat(record)
      const stored = { ...backend, uuid, created_at: backend.created_at || now, updated_at: backend.updated_at || now }
      const id = await addProject(stored)
      const created = buildCreatedProjectRecord(record, { id, uuid, now })
      total.value += 1
      if (!searchKeyword.value && currentPage.value === 1) {
        const next = order.value === 'asc'
          ? [...projects.value, created]
          : [created, ...projects.value]
        projects.value = next.slice(0, pageSize)
      }
      selectedProjectId.value = created.id
      return { success: true, data: created }
    } catch (e) {
      return { success: false, error: e?.message || '创建项目失败' }
    }
  }

  async function update(id, partial) {
    const existing = await dbGet(id)
    if (!existing) return { success: false, error: '项目不存在' }
    const merged = { ...convertToFrontendFormat(existing), ...partial }
    const now = new Date().toISOString()
    merged.updatedAt = now
    const backend = convertToBackendFormat(merged)
    const updated = await dbUpdate(id, { ...backend, uuid: existing.uuid, created_at: existing.created_at || existing.createdAt, updated_at: now })
    const idx = projects.value.findIndex(p => p.id === id)
    const frontend = addCompatibilityShims(convertToFrontendFormat({ ...updated }))
    if (idx !== -1) projects.value[idx] = frontend
    if (selectedProjectId.value === id) selectedProjectId.value = id
    return { success: true, data: frontend }
  }

  async function remove(id) {
    await dbDelete(id)
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) projects.value.splice(idx, 1)
    total.value = Math.max(0, total.value - 1)
    if (selectedProjectId.value === id) selectedProjectId.value = null
    // If current page becomes empty and not first, load previous
    if (projects.value.length === 0 && currentPage.value > 1) {
      await loadPage(currentPage.value - 1)
    }
    return { success: true }
  }

  async function select(id) {
    selectedProjectId.value = id
    return { success: true }
  }

  function toggleOrder(){ order.value = order.value === 'desc' ? 'asc' : 'desc'; loadPage(1) }

  const totalPages = computed(() => Math.ceil(total.value / pageSize))
  const currentProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value) || null)

  return {
    // state
    projects, loading, error, pageSize, currentPage, total, totalPages, searchKeyword, selectedProjectId, currentProject, order,
    // actions
    loadPage, search, create, update, remove, select, toggleOrder
  }
}
