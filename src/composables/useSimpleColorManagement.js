import { ref, computed } from 'vue'
import { colorAPI } from '../api'

export function useSimpleColorManagement() {
  const colors = ref([])
  const loading = ref(false)
  const error = ref(null)

  const colorCount = computed(() => colors.value.length)

  const loadColors = async () => {
    loading.value = true
    error.value = null

    try {
      const result = await colorAPI.getColorPalettes()
      if (result.success) {
        colors.value = result.data.color_palettes || []
      } else {
        throw new Error(result.error || 'Failed to load colors')
      }
    } catch (err) {
      error.value = err.message
      console.error('Failed to load colors:', err)
    } finally {
      loading.value = false
    }
  }

  const createColor = async (colorData) => {
    try {
      const result = await colorAPI.addColorPalette(colorData)
      if (result.success) {
        await loadColors()
        return { success: true, data: result.data }
      }
      throw new Error(result.error || 'Failed to create color')
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  const updateColor = async (colorData) => {
    try {
      const result = await colorAPI.updateColorPalette(colorData.id, colorData)
      if (result.success) {
        await loadColors()
        return { success: true, data: result.data }
      }
      throw new Error(result.error || 'Failed to update color')
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  const deleteColor = async (color) => {
    try {
      const result = await colorAPI.deleteColorPalette(color.id)
      if (result.success) {
        await loadColors()
        return { success: true }
      }
      throw new Error(result.error || 'Failed to delete color')
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  const batchDeleteColors = async (colorIds) => {
    try {
      const result = await colorAPI.batchDeleteColorPalettes(colorIds)
      if (result.success) {
        await loadColors()
        return { success: true, data: result.data }
      }
      throw new Error(result.error || 'Failed to delete colors')
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  const duplicateColor = async (color) => {
    const duplicatedColor = {
      ...color,
      name: `${color.name} Copy`,
      id: undefined
    }
    return await createColor(duplicatedColor)
  }

  return {
    colors,
    loading,
    error,
    colorCount,
    loadColors,
    createColor,
    updateColor,
    deleteColor,
    batchDeleteColors,
    duplicateColor
  }
}
