<template>
  <el-container style="height: 100vh;">
    <el-header class="app-header">
      <div class="left-tools">
        <!-- iOS style new project button (only) -->
        <button class="ios-btn" @click="showProjectManager = true">{{ $t('edit.projects') }}</button>
        
        <ColorPanel
          ref="colorPanelRef"
          :style="{ width: colorPanelWidth + 'px' }"
          :colorPalette="colorPalette"
          :selectedColorIndex="selectedColorIndex"
          @select-color="selectColor"
          @manage-colors="handleManageColors"
          @manage-color-center="handleColorManagementCenter"
        />
      </div>
    </el-header>

    <el-main class="main-area">
      <ResizableSplitter @resize="onSidebarResize" />

      <template v-if="currentProject">
        <DiamondCanvas
          :key="currentProject ? currentProject.id : 'empty'"
          :projectData="currentProject"
        />
      </template>
      <div v-else class="empty-project-placeholder">
        <h2>{{ $t('edit.welcomeTitle') }}</h2>
        <p>{{ $t('edit.welcomeHint') }}</p>
        <el-button type="primary" size="large" @click="showProjectManager = true">{{ $t('edit.openProject') }}</el-button>
      </div>

      <ResizableSplitter direction="right" @resize="onColorPanelResize" />
    </el-main>
  </el-container>

  
  <ColorPickerModal
    v-if="showColorPicker"
    :nextColorCode="nextColorCode"
    @close="showColorPicker = false"
    @confirm="handleAddColor"
    @remove-color="handleDeleteColor"
  />

  <ColorManagementCenter
    v-if="showColorManagementCenter"
    :nextColorCode="nextColorCode"
    @close="handleColorManagementCenterClose"
    @confirm="handleAddColor"
  />

  <ProjectManager
    v-model="showProjectManager"
    @project-created="handleProjectCreated"
    @project-imported="handleProjectImported"
  />
</template>

<script>
import { onMounted, ref, markRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import Sidebar from './Sidebar.vue'
import DiamondCanvas from './DiamondCanvas/DiamondCanvas.vue'
import ColorPanel from './ColorPanel.vue'
import ColorPickerModal from './ColorManagement/ColorPickerModal.vue'
import ColorManagementCenter from './ColorManagementCenter.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ResizableSplitter from './ResizableSplitter.vue'
import ProjectManager from './Project/ProjectManager.vue'
// composables
import { useColorManagement } from '../composables/useColorManagement'
import { useCanvasSettings } from '../composables/useCanvasSettings'
import { useImageProcessing } from '../composables/useImageProcessing'
import { useLayoutManagement } from '../composables/useLayoutManagement'

export default {
  name: 'EditCanvas',
  components: {
    Sidebar,
    DiamondCanvas,
    ColorPanel,
    ColorPickerModal,
    ColorManagementCenter,
    LanguageSwitcher,
    ResizableSplitter,
    ProjectManager
  },
  setup() {
    const { t } = useI18n()
    const colorPanelRef = ref(null)
    const showProjectManager = ref(false)
    const currentProject = ref(null)

    const colorManagement = useColorManagement()
    const canvasSettings = useCanvasSettings()
    const imageProcessing = useImageProcessing()
    const layoutManagement = useLayoutManagement()

    const handleGenerateDiamondArt = async () => {
      const result = await imageProcessing.generateDiamondArt(
        canvasSettings,
        colorManagement.colorPalette.value
      )
      if (result.success && result.data) {
        colorManagement.updateColorUsage(result.data)
      }
      return result
    }

    const handleCellClick = (x, y) => {
      const result = imageProcessing.onCellClick(x, y, colorManagement.selectedColorIndex.value)
      if (result.success) {
        colorManagement.updateColorUsage(imageProcessing.diamondData.value)
      }
      return result
    }

    const handleSaveResult = async () => {
      return await imageProcessing.saveResult(canvasSettings, colorManagement.colorPalette.value)
    }

    const handleAddColor = async (colorData) => {
      const result = await colorManagement.addColor(colorData)
      if (result.success) {
        imageProcessing.updateStatus(result.message, 'success')
      } else {
        imageProcessing.updateStatus(result.message, 'error')
        alert(result.message)
      }
      return result
    }

    const handleDeleteColor = async (colorId) => {
      const result = await colorManagement.deleteColor(colorId)
      if (result.success) {
        imageProcessing.updateStatus(result.message, 'success')
      } else {
        imageProcessing.updateStatus(result.message, 'error')
      }
      return result
    }

    const handleResetSettings = () => {
      const result = canvasSettings.resetSettings()
      colorManagement.selectedColorIndex.value = -1
      imageProcessing.updateStatus(result.message)
    }

    const handleColorManagementCenterClose = async () => {
      colorManagement.showColorManagementCenter.value = false
      const result = await colorManagement.loadColorPalettes()
      if (!result.success) {
        imageProcessing.updateStatus(result.message, 'error')
      }
      if (colorPanelRef.value && colorPanelRef.value.refreshGroups) {
        await colorPanelRef.value.refreshGroups()
      }
    }

    const handleColorManagementCenter = () => {
      colorManagement.showColorManagementCenter.value = true
    }

    onMounted(async () => {
      const result = await colorManagement.loadColorPalettes()
      if (result.success) {
        imageProcessing.updateStatus(result.message)
      } else {
        imageProcessing.updateStatus(result.message, 'error')
      }
    })

    const prepareProjectForCanvas = (project) => {
      if (!project || typeof project !== 'object') return project
      return {
        ...project,
        cellsMatrix: Array.isArray(project.cellsMatrix) ? markRaw(project.cellsMatrix) : project.cellsMatrix
      }
    }

    const handleProjectCreated = (project) => {
      currentProject.value = prepareProjectForCanvas(project)
      imageProcessing.updateStatus(t('edit.projectCreated', { name: project.name }), 'success')
    }

    const handleProjectImported = (project) => {
      currentProject.value = prepareProjectForCanvas(project)
      imageProcessing.updateStatus(t('edit.projectImported', { name: project.name }), 'success')
    }

    const handleCellChange = (data) => { console.log('Canvas cell changed:', data) }
    const handleGridChange = (gridData) => { if (currentProject.value?.grid) Object.assign(currentProject.value.grid, gridData) }
    const handleBackgroundChange = (imageData) => { if (currentProject.value?.image) Object.assign(currentProject.value.image, imageData) }

    return {
      t,
      colorPanelRef,
      showProjectManager,
      currentProject,
      ...colorManagement,
      ...canvasSettings,
      ...imageProcessing,
      ...layoutManagement,
      generateDiamondArt: handleGenerateDiamondArt,
      onCellClick: handleCellClick,
      saveResult: handleSaveResult,
      addColor: handleAddColor,
      deleteColor: handleDeleteColor,
      resetSettings: handleResetSettings,
      handleGenerateDiamondArt,
      handleCellClick,
      handleSaveResult,
      handleAddColor,
      handleDeleteColor,
      handleColorManagementCenterClose,
      handleColorManagementCenter,
      handleProjectCreated,
      handleProjectImported,
      handleCellChange,
      handleGridChange,
      handleBackgroundChange
    }
  }
}
</script>

<style scoped>
.app-header {display:flex; align-items:center; justify-content:space-between; height:60px; background:#f5f5f7; border-bottom:1px solid #e5e5ea; padding:0 16px 0 160px;} /* further left padding to avoid overlap with floating back button */
.left-tools {display:flex; gap:24px; align-items:center;}
.ios-btn {background:#ffffff; border:1px solid #d9d9de; border-radius:18px; padding:6px 16px; font-size:14px; font-weight:500; line-height:20px; color:#0071e3; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.02); backdrop-filter:saturate(180%) blur(20px); transition:background .2s, box-shadow .2s; -webkit-font-smoothing:antialiased;}
.ios-btn:hover {background:#f2f2f7;}
.ios-btn:active {background:#e5e5ea; box-shadow:0 0 0 1px rgba(0,0,0,0.1) inset;}
.ios-btn:focus {outline:none; box-shadow:0 0 0 3px rgba(0,113,227,0.3);}
.main-area {padding:0; display:flex; overflow:hidden;}
.empty-project-placeholder {flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:#333; font-size:16px;}
.empty-project-placeholder h2 {margin:0; font-weight:600; font-size:24px; color:#111;}
.empty-project-placeholder p {margin:0 0 8px; color:#666;}
</style>
