/**
 * Color Group API - JavaScript interface migrated from C++ to IndexedDB
 */

import {
  getAllColorGroups,
  addColorGroup as addGroupStore,
  updateColorGroupInternal,
  deleteColorGroupInternal,
  batchDeleteGroupsInternal,
  getColorGroupInternal,
  getAllColorPalettes
} from '../database/indexeddb/colorStore.js'

function buildGroupDTO(raw, paletteMap) {
  const colorObjects = (raw.color_ids || []).map(id => {
    const color = paletteMap.get(id)
    if (!color) return null
    return {
      id: color.id,
      name: color.name,
      rgb: { r: color.rgb_r, g: color.rgb_g, b: color.rgb_b },
      hex: color.hex_color
    }
  }).filter(Boolean)
  return {
    id: raw.id,
    name: raw.name,
    color_ids: colorObjects, // mimic C++ get_color_groups structure
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null
  }
}

export async function getColorGroups() {
  try {
    const [groups, palettes] = await Promise.all([getAllColorGroups(), getAllColorPalettes()])
    const paletteMap = new Map(palettes.map(p => [p.id, p]))
    const data = groups.map(g => buildGroupDTO(g, paletteMap))
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message, error_code: 'DATABASE_ERROR' }
  }
}

export async function getColorGroupById(groupId) {
  try {
    const group = await getColorGroupInternal(groupId)
    if (!group) return { success: false, error: 'Color group not found', error_code: 'DATABASE_ERROR' }
    const palettes = await getAllColorPalettes()
    const paletteMap = new Map(palettes.map(p => [p.id, p]))
    return { success: true, data: buildGroupDTO(group, paletteMap) }
  } catch (error) {
    return { success: false, error: error.message, error_code: 'DATABASE_ERROR' }
  }
}

export async function createColorGroup(groupData) {
  try {
    if (!groupData.name) return { success: false, error: 'Missing required parameter: name', error_code: 'DATABASE_ERROR' }
    const created = await addGroupStore({ name: groupData.name, color_ids: groupData.color_ids || [] })
    const palettes = await getAllColorPalettes()
    const paletteMap = new Map(palettes.map(p => [p.id, p]))
    return { success: true, data: buildGroupDTO(created, paletteMap) }
  } catch (error) {
    return { success: false, error: error.message, error_code: 'DATABASE_ERROR' }
  }
}

export async function updateColorGroup(groupId, groupData) {
  try {
    if (!groupData.name) return { success: false, error: 'Missing required parameter: name', error_code: 'DATABASE_ERROR' }
    const updated = await updateColorGroupInternal(groupId, { name: groupData.name, color_ids: groupData.color_ids || [] })
    const palettes = await getAllColorPalettes()
    const paletteMap = new Map(palettes.map(p => [p.id, p]))
    return { success: true, data: buildGroupDTO(updated, paletteMap) }
  } catch (error) {
    return { success: false, error: error.message, error_code: 'DATABASE_ERROR' }
  }
}

export async function deleteColorGroup(groupId) {
  try {
    await deleteColorGroupInternal(groupId)
    return { success: true, data: { id: groupId } }
  } catch (error) {
    return { success: false, error: error.message, error_code: 'DATABASE_ERROR' }
  }
}

export async function addColorsToGroup(groupId, colors) {
  try {
    const group = await getColorGroupInternal(groupId)
    if (!group) return { success: false, error: 'Color group not found', error_code: 'DATABASE_ERROR' }
    const newIds = colors.map(c => typeof c === 'object' ? c.id : c)
    const merged = Array.from(new Set([...(group.color_ids||[]), ...newIds]))
    const updated = await updateColorGroupInternal(groupId, { name: group.name, color_ids: merged })
    const palettes = await getAllColorPalettes(); const paletteMap = new Map(palettes.map(p => [p.id,p]))
    return { success: true, data: buildGroupDTO(updated, paletteMap) }
  } catch (error) { return { success:false, error:error.message, error_code:'DATABASE_ERROR' } }
}

export async function removeColorFromGroup(groupId, colorId) {
  try {
    const group = await getColorGroupInternal(groupId)
    if (!group) return { success:false, error:'Color group not found', error_code:'DATABASE_ERROR' }
    const filtered = (group.color_ids||[]).filter(id => id !== colorId)
    if (filtered.length === (group.color_ids||[]).length) return { success:false, error:'Color not found in group', error_code:'DATABASE_ERROR' }
    const updated = await updateColorGroupInternal(groupId, { name: group.name, color_ids: filtered })
    const palettes = await getAllColorPalettes(); const paletteMap = new Map(palettes.map(p => [p.id,p]))
    return { success:true, data: buildGroupDTO(updated, paletteMap) }
  } catch (error) { return { success:false, error:error.message, error_code:'DATABASE_ERROR' } }
}

export async function updateColorInGroup(groupId, oldColorId, newColorData) {
  try {
    const group = await getColorGroupInternal(groupId)
    if (!group) return { success:false, error:'Color group not found', error_code:'DATABASE_ERROR' }
    const ids = [...(group.color_ids||[])]
    const idx = ids.indexOf(oldColorId)
    if (idx === -1) return { success:false, error:'Color not found in group', error_code:'DATABASE_ERROR' }
    const newId = typeof newColorData === 'object' ? newColorData.id : newColorData
    ids[idx] = newId
    const updated = await updateColorGroupInternal(groupId, { name: group.name, color_ids: ids })
    const palettes = await getAllColorPalettes(); const paletteMap = new Map(palettes.map(p => [p.id,p]))
    return { success:true, data: buildGroupDTO(updated, paletteMap) }
  } catch (error) { return { success:false, error:error.message, error_code:'DATABASE_ERROR' } }
}

export async function batchDeleteColorGroups(groupIds) {
  try {
    const { deleted, notFound } = await batchDeleteGroupsInternal(groupIds)
    return { success:true, data:{ deleted: deleted.map(id => ({ id })), notFound } }
  } catch (error) { return { success:false, error:error.message, error_code:'DATABASE_ERROR' } }
}
