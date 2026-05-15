<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>{{ $t('colorManagement.title') }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="modal-body">
        
        <div class="tab-navigation">
          <div 
            v-for="tab in tabs" 
            :key="tab.id"
            class="tab-item"
            :class="{ active: activeTab === tab.id }"
            @click="switchTab(tab.id)"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </div>
        </div>

        
        <div class="tab-content">
          
          <div v-if="activeTab === 'create'" class="tab-panel">
            <div class="color-management-layout">
              
              <div class="left-section">
                <ColorLibraryPanel
                  :colors="colors"
                  :loading="loading"
                  :items-per-page="24"
                  @import="handleImport"
                  @export="handleExport"
                  @color-click="handleColorClick"
                  @color-edit="handleColorEdit"
                  @color-delete="handleColorDelete"
                  @batch-delete="handleBatchDelete"
                />
              </div>

              
              <div class="right-section">
                <ColorCreationPanel
                  @create-color="handleCreateColor"
                />
              </div>
            </div>
          </div>

          
          <div v-if="activeTab === 'groups'" class="tab-panel">
            <ColorGroupPanel
              :key="colorGroupsKey"
              :groups="colorGroups"
              :loading="loadingGroups"
              @create-group="handleCreateGroup"
              @edit-group="handleEditGroup"
              @delete-group="handleDeleteGroup"
              @export-all="handleExportAllGroups"
              @import-groups="handleImportGroups"
              @import-error="handleImportError"
              @add-to-group="handleAddToGroup"
              @remove-from-group="handleRemoveFromGroup"
              @color-click="handleColorClick"
              @color-edit="handleColorEdit"
              @color-delete="handleColorDelete"
            />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-left">
          <span class="status-text" v-if="statusMessage">{{ statusMessage }}</span>
        </div>
        <div class="footer-right">
          <button class="btn btn-secondary" @click="close">
            {{ $t('common.close') }}
          </button>
        </div>
      </div>
    </div>

    
    <GroupNameDialog
      :visible="showGroupNameDialog"
      :editing-group="editingGroup"
      :initial-name="groupNameInput"
      @confirm="confirmGroupName"
      @cancel="cancelGroupDialog"
    />
    
    <AddColorDialog
      :visible="showAddColorDialog"
      :target-group="targetGroup"
      :colors="colors"
      @confirm="confirmAddColors"
      @cancel="cancelAddColorDialog"
    />
    
        <!-- 编辑色卡弹窗 -->
    <EditColorDialog
      :visible="showEditColorDialog"
      :editing-color="editingColor"
      :color-groups="colorGroups"
      @confirm="confirmEditColor"
      @cancel="cancelEditColor"
    />
    
    <!-- 权限验证弹窗（全局模式） -->
    <PasswordModal global-mode />
  </div>
</template>

<script>
import { useSimpleColorManagement } from '../composables/useSimpleColorManagement'
import ColorLibraryPanel from './ColorManagement/ColorLibraryPanel.vue'
import ColorCreationPanel from './ColorManagement/ColorCreationPanel.vue'
import ColorGroupPanel from './ColorManagement/ColorGroupPanel.vue'
import GroupNameDialog from './ColorManagement/GroupNameDialog.vue'
import AddColorDialog from './ColorManagement/AddColorDialog.vue'
import EditColorDialog from './ColorManagement/EditColorDialog.vue'
import PasswordModal from './PasswordModal.vue'
import { useColorGroups } from "../composables/useColorGroups.js"
import { useI18n } from 'vue-i18n'
import eventBus, { EVENT_TYPES } from '../utils/eventBus.js'
import colorAPI from '../api/colorAPI.js' // added
import { requireAdminPermission, clearColorManagementAdminSession } from '../utils/permission.js'

export default {
  name: 'ColorManagementCenter',
  components: {
    ColorLibraryPanel,
    ColorCreationPanel,
    ColorGroupPanel,
    GroupNameDialog,
    AddColorDialog,
    EditColorDialog,
    PasswordModal
  },
  props: {
    nextColorCode: { type: String, required: true }
  },
  setup() {
    const { t } = useI18n()
    const {
      colors,
      loading,
      error,
      loadColors,
      createColor,
      updateColor,
      deleteColor,
      batchDeleteColors,
      duplicateColor
    } = useSimpleColorManagement()

    const {
      loadColorGroups,
      createGroup,
      deleteGroup,
      updateGroup
    } = useColorGroups()

    return {
      t,
      colors,
      loading,
      error,
      loadColors,
      createColor,
      updateColor,
      deleteColor,
      batchDeleteColors,
      duplicateColor,
      loadColorGroups,
      createGroup,
      deleteGroup,
      updateGroup
    }
  },
  data() {
    return {
      // 
      activeTab: 'groups',

      // 
      statusMessage: '',

      // 
      colorGroups: [],
      colorGroupsKey: 0, // 
      loadingGroups: false,
      
      // 
      showGroupNameDialog: false,
      groupNameInput: '',
      editingGroup: null,
      
      // 
      showAddColorDialog: false,
      targetGroup: null,
      
      // 
      showEditColorDialog: false,
      editingColor: null,
      selectedColors: [],
    }
  },
  computed: {
    // 
    tabs() {
      return [
        { 
          id: 'groups', 
          icon: '📂', 
          label: this.$t('colorManagement.groupsTab')
        },
        { 
          id: 'create', 
          icon: '🎨', 
          label: this.$t('colorManagement.createTab')
        }
      ]
    }
  },
  async mounted() {
    await this.loadColors()
    await this.loadAndProcessColorGroups()
  },
  beforeUnmount() {
    clearColorManagementAdminSession()
  },
  methods: {
    //  - color_ids
    convertColorIdsToColors(colorIds) {
      if (!colorIds || !Array.isArray(colorIds)) {
        return []
      }
      
      // 
      if (colorIds.length > 0 && typeof colorIds[0] === 'object' && colorIds[0].hex) {
        // color_ids 
        return colorIds
      } else {
        // color_ids IDthis.colors
        return colorIds.map(colorId => {
          const color = this.colors.find(c => c.id === colorId)
          return color || { id: colorId, name: 'Unknown', hex: '#000000' }
        }).filter(Boolean)
      }
    },

    //  - 
    async loadAndProcessColorGroups() {
      // 
      if (this.loadingGroups) {
        return
      }
      
      try {
        this.loadingGroups = true
        
        //  setup  loadColorGroups 
        const result = await this.loadColorGroups()
        
        if (result.success) {
          // 
          const newColorGroups = result.data.map(group => {
            const convertedColors = this.convertColorIdsToColors(group.color_ids || [])
            
            return {
              id: group.id,
              name: group.name,
              colors: convertedColors
            }
          })
          
          // Vue 3 
          this.colorGroups = newColorGroups
          
          //  key 
          this.colorGroupsKey++
        } else {
          console.error('Failed to load color groups:', result.error)
          this.colorGroups = []
        }
      } catch (error) {
        console.error('Error loading color groups:', error)
        this.colorGroups = []
      } finally {
        this.loadingGroups = false
      }
    },

    // 
    async switchTab(tabId) {
      this.activeTab = tabId
    },

    close() {
      clearColorManagementAdminSession()
      this.$emit('close')
    },

    handleOverlayClick() {
      this.close()
    },

    // 
    async handleCreateColor(colorData) {
      // 客户要求：不在 tab 上拦截，改为点“创建”按钮时校验
      const ok = await requireAdminPermission('创建色卡')
      if (!ok) return
      const result = await this.createColor(colorData)
      if (result.success) {
        eventBus.emit(EVENT_TYPES.COLOR_CREATED, result.data)
        eventBus.emit(EVENT_TYPES.COLORS_CHANGED)
        this.showStatusMessage(this.$t('colorManagement.createSuccess'), 'success')
      } else {
        // 
        const errorMessage = this.translateErrorMessage(result.error)
        this.showStatusMessage(`${this.$t('colorManagement.createFailed')}: ${errorMessage}`, 'error')
      }
    },

    // 
    async handleColorDelete(color) {
      const ok = await requireAdminPermission('删除色卡')
      if (!ok) return

      const colorDisplayName = color.name !== 'unknown' ? color.name : color.hex
      if (!confirm(this.$t('colorManagement.confirmDelete', { name: colorDisplayName }))) {
        return
      }

      const result = await this.deleteColor(color)
      if (result.success) {
        await this.loadAndProcessColorGroups()
        eventBus.emit(EVENT_TYPES.COLOR_DELETED, color.id)
        eventBus.emit(EVENT_TYPES.COLORS_CHANGED)
        eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
        this.showStatusMessage(this.$t('colorManagement.deleteSuccess'), 'success')
      } else {
        this.showStatusMessage(`${this.$t('colorManagement.deleteFailed')}: ${result.error}`, 'error')
      }
    },

    async handleBatchDelete(colors) {
      const selectedColors = Array.isArray(colors) ? colors : []
      if (selectedColors.length === 0) {
        this.showStatusMessage(this.$t('colorManagement.selectColorsToDelete'), 'error')
        return
      }

      const ok = await requireAdminPermission('批量删除色卡')
      if (!ok) return

      if (!confirm(this.$t('colorManagement.confirmBulkDelete', { count: selectedColors.length }))) {
        return
      }

      const colorIds = selectedColors
        .map(color => color?.id)
        .filter(id => id != null)

      const result = await this.batchDeleteColors(colorIds)
      if (result.success) {
        await this.loadAndProcessColorGroups()
        eventBus.emit(EVENT_TYPES.COLORS_CHANGED)
        eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
        this.showStatusMessage(this.$t('colorManagement.bulkDeleteSuccess', {
          count: result.data?.deleted_count ?? colorIds.length
        }), 'success')
      } else {
        this.showStatusMessage(`${this.$t('colorManagement.bulkDeleteFailed')}: ${result.error}`, 'error')
      }
    },


    // 
    handleColorClick(color) {
      // 
    },

    // 
    async handleColorEdit(color) {
      this.editingColor = color
      this.editColorName = color.name !== 'unknown' ? color.name : ''
      this.editColorHex = color.hex
      this.showEditColorDialog = true
    },

    // 
    handleCreateGroup() {
      this.editingGroup = null
      this.groupNameInput = ''
      this.showGroupNameDialog = true
      this.$nextTick(() => {
        if (this.$refs.groupNameInputRef) {
          this.$refs.groupNameInputRef.focus()
        }
      })
    },

    async handleEditGroup(group) {
      this.editingGroup = group
      this.groupNameInput = group.name
      this.showGroupNameDialog = true
      this.$nextTick(() => {
        if (this.$refs.groupNameInputRef) {
          this.$refs.groupNameInputRef.focus()
          this.$refs.groupNameInputRef.select()
        }
      })
    },

    async confirmGroupName(groupName) {
      if (!groupName || !groupName.trim()) {
        this.showStatusMessage(this.$t('colorManagement.groupNameRequired'), 'error')
        return
      }

      try {
        if (this.editingGroup) {
          // 
          // 注意：IndexedDB 的 updateColorGroup 是“全量更新”（name + color_ids），
          // 若不带 color_ids 会被默认成 []，导致分组色卡被清空。
          const currentGroup = this.colorGroups.find(g => g.id === this.editingGroup.id)
          const color_ids = (currentGroup?.colors || []).map(c => (typeof c === 'object' ? c.id : c)).filter(v => v != null)
          const result = await this.updateGroup(this.editingGroup.id, {
            name: groupName.trim(),
            color_ids
          })
          
          if (result.success) {
            // 
            await this.loadAndProcessColorGroups()
            this.showStatusMessage(this.$t('colorManagement.groupNameUpdated', { name: groupName.trim() }), 'success')
            
            // 
            eventBus.emit(EVENT_TYPES.COLOR_GROUP_UPDATED, result.data)
            eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
          } else {
            this.showStatusMessage(result.error || this.$t('colorManagement.updateGroupFailed'), 'error')
            return
          }
        } else {
          // 
          const result = await this.createGroup({
            name: groupName.trim(),
            color_ids: []
          })
          
          if (result.success) {
            // 
            await this.loadAndProcessColorGroups()
            this.showStatusMessage(this.$t('colorManagement.createGroupSuccessNamed', { name: result.data.name }), 'success')
            
            // 
            eventBus.emit(EVENT_TYPES.COLOR_GROUP_CREATED, result.data)
            eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
          } else {
            this.showStatusMessage(result.error || this.$t('colorManagement.createGroupFailed'), 'error')
            return
          }
        }

        this.cancelGroupDialog()
      } catch (error) {
        console.error('group operation failed', error)
        this.showStatusMessage(this.$t('colorManagement.groupOperationFailed'), 'error')
      }
    },

    cancelGroupDialog() {
      this.showGroupNameDialog = false
      this.groupNameInput = ''
      this.editingGroup = null
    },

    // 
    toggleColorSelection(color) {
      const index = this.selectedColors.findIndex(c => c.id === color.id)
      
      if (index > -1) {
        this.selectedColors.splice(index, 1)
      } else {
        this.selectedColors.push(color)
      }
    },

    isColorSelected(color) {
      return this.selectedColors.some(c => c.id === color.id)
    },

    isColorInGroup(color) {
      return this.targetGroup?.colors?.some(c => c.id === color.id) || false
    },

    async confirmAddColors(selectedColors) {
      if (selectedColors.length === 0) {
        this.showStatusMessage(this.$t('colorManagement.selectColorsFirst'), 'error')
        return
      }

      try {
        // ID
        const currentGroup = this.colorGroups.find(g => g.id === this.targetGroup.id)
        if (!currentGroup) {
          this.showStatusMessage(this.$t('colorManagement.groupMissing'), 'error')
          return
        }

        // 
        const newColors = selectedColors.filter(color => 
          !currentGroup.colors.some(c => c.id === color.id)
        )

        if (newColors.length === 0) {
          this.showStatusMessage(this.$t('colorManagement.selectedAlreadyInGroup'), 'error')
          return
        }

        // ID
        const existingColorIds = currentGroup.colors.map(c => c.id)
        const newColorIds = newColors.map(c => c.id)
        const allColorIds = [...existingColorIds, ...newColorIds]

        // API
        const result = await this.updateGroup(this.targetGroup.id, {
          name: currentGroup.name,
          color_ids: allColorIds
        })

        if (result.success) {
          await this.loadAndProcessColorGroups()
          eventBus.emit(EVENT_TYPES.COLOR_GROUP_UPDATED, result.data)
          eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
          this.showStatusMessage(this.$t('colorManagement.addColorsSuccess', { count: newColors.length, name: this.targetGroup.name }), 'success')
        } else {
          this.showStatusMessage(result.error || this.$t('colorManagement.addColorsFailed'), 'error')
          return
        }
      } catch (error) {
        console.error('add colors to group failed', error)
        this.showStatusMessage(this.$t('colorManagement.addColorsGenericFailed'), 'error')
        return
      }

      this.cancelAddColorDialog()
    },

    cancelAddColorDialog() {
      this.showAddColorDialog = false
      this.targetGroup = null
      this.selectedColors = []
    },

    getGroupColorIds(group) {
      return (group?.colors || [])
        .map(color => (typeof color === 'object' ? color.id : color))
        .filter(id => id != null)
    },

    async syncColorGroupMembership(colorId, groupIds) {
      const targetGroupIds = new Set(Array.isArray(groupIds) ? groupIds : [])
      for (const group of this.colorGroups) {
        const currentColorIds = this.getGroupColorIds(group)
        const hasColor = currentColorIds.includes(colorId)
        const shouldHaveColor = targetGroupIds.has(group.id)
        if (hasColor === shouldHaveColor) continue

        const nextColorIds = shouldHaveColor
          ? [...currentColorIds, colorId]
          : currentColorIds.filter(id => id !== colorId)

        const result = await this.updateGroup(group.id, {
          name: group.name,
          color_ids: nextColorIds
        })
        if (!result.success) {
          throw new Error(result.error || this.$t('colorManagement.updateGroupFailed'))
        }
      }
    },

    // 
    async confirmEditColor(editData) {
      const { color, groupIds } = editData
      
      if (!color.name.trim()) {
        this.showStatusMessage(this.$t('colorManagement.editColorNameEmpty'), 'error')
        return
      }

      if (!color.hex || !color.hex.match(/^#[0-9A-Fa-f]{6}$/)) {
        this.showStatusMessage(this.$t('colorManagement.invalidColorCode'), 'error')
        return
      }

      try {
        const updatedColor = {
          ...color,
          name: color.name.trim(),
          hex: color.hex.toUpperCase()
        }
        const result = await this.updateColor(updatedColor)
        if (!result.success) {
          const errorMessage = this.translateErrorMessage(result.error)
          this.showStatusMessage(`${this.$t('colorManagement.groupOperationFailed')}: ${errorMessage}`, 'error')
          return
        }

        await this.syncColorGroupMembership(updatedColor.id, groupIds)
        await this.loadAndProcessColorGroups()
        eventBus.emit(EVENT_TYPES.COLORS_CHANGED)
        eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
        this.showStatusMessage(this.$t('colorManagement.colorUpdatedSuccess'), 'success')
        this.cancelEditColor()
      } catch (error) {
        console.error('edit color failed', error)
        this.showStatusMessage(error.message || this.$t('colorManagement.groupOperationFailed'), 'error')
      }
    },

    cancelEditColor() {
      this.showEditColorDialog = false
      this.editingColor = null
    },

    async handleDeleteGroup(group) {
      if (!confirm(this.$t('colorManagement.confirmDeleteGroupIrreversible', { name: group.name }))) {
        return
      }
      
      try {
        const result = await this.deleteGroup(group.id)
        
        if (result.success) {
          // 
          await this.loadAndProcessColorGroups()
          this.showStatusMessage(this.$t('colorManagement.groupDeletedSuccess', { name: group.name }), 'success')
          
          // 
          eventBus.emit(EVENT_TYPES.COLOR_GROUP_DELETED, group.id)
          eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
        } else {
          this.showStatusMessage(result.error || this.$t('colorManagement.deleteGroupFailed'), 'error')
        }
      } catch (error) {
        console.error('delete group failed', error)
        this.showStatusMessage(this.$t('colorManagement.deleteGroupRetryFailed'), 'error')
      }
    },

    handleExportAllGroups() {
      if (this.colorGroups.length === 0) {
        this.showStatusMessage(this.$t('colorManagement.noGroupsToExport'), 'error')
        return
      }
      
      try {
        const exportData = {
          groups: this.colorGroups,
          exportTime: new Date().toISOString(),
          version: '1.0'
        }
        
        const dataStr = JSON.stringify(exportData, null, 2)
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = url
        link.download = `color-groups-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        URL.revokeObjectURL(url)
        this.showStatusMessage(this.$t('colorManagement.groupsExportedSuccess'), 'success')
      } catch (error) {
        console.error('Export error:', error)
        this.showStatusMessage(this.$t('colorManagement.exportFailedMsg', { msg: error.message }), 'error')
      }
    },

    async handleImportGroups(importedGroups) {
      try {
        this.showStatusMessage(this.$t('colorManagement.importingGroupsData'), 'info')
        
        let successCount = 0
        let skipCount = 0
        let errorCount = 0
        
        for (const importGroup of importedGroups) {
          try {
            // 
            const existingGroup = this.colorGroups.find(g => g.name === importGroup.name)
            if (existingGroup) {
              console.log(` "${importGroup.name}" `)
              skipCount++
              continue
            }
            
            //  - 
            const validColorIds = []
            if (importGroup.colors && Array.isArray(importGroup.colors)) {
              for (const importColor of importGroup.colors) {
                // hexid
                const existingColor = this.colors.find(c => 
                  c.hex === importColor.hex || c.id === importColor.id
                )
                if (existingColor) {
                  validColorIds.push(existingColor.id)
                }
              }
            }
            
            // 
            const result = await this.createGroup({
              name: importGroup.name,
              color_ids: validColorIds
            })
            
            if (result.success) {
              successCount++
            } else {
              console.error(` "${importGroup.name}" :`, result.error)
              errorCount++
            }
            
          } catch (error) {
            console.error(` "${importGroup.name}" :`, error)
            errorCount++
          }
        }
        
        // 
        await this.loadAndProcessColorGroups()
        
        const resultMessage = this.$t('colorManagement.importGroupsSummary', {
          success: successCount,
          skipped: skipCount,
          failed: errorCount
        })
        this.showStatusMessage(resultMessage, successCount > 0 ? 'success' : 'warning')
        
        // 
        eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
        
      } catch (error) {
        console.error('import groups failed', error)
        this.showStatusMessage(this.$t('colorManagement.importFailedMsg', { msg: error.message }), 'error')
      }
    },

    handleImportError(errorMessage) {
      this.showStatusMessage(this.$t('colorManagement.importFailedMsg', { msg: errorMessage }), 'error')
    },

    handleAddToGroup(group) {
      this.targetGroup = group
      this.selectedColors = []
      this.showAddColorDialog = true
    },

    async handleRemoveFromGroup({ group, color }) {
      if (!confirm(this.$t('colorManagement.confirmRemoveColorFromGroup', {
        group: group.name,
        color: color.name !== 'unknown' ? color.name : color.hex
      }))) {
        return
      }

      try {
        const currentGroup = this.colorGroups.find(g => g.id === group.id)
        if (!currentGroup) {
          this.showStatusMessage(this.$t('colorManagement.groupMissing'), 'error')
          return
        }
        const nextColorIds = this.getGroupColorIds(currentGroup).filter(id => id !== color.id)
        const result = await this.updateGroup(group.id, {
          name: currentGroup.name,
          color_ids: nextColorIds
        })
        if (!result.success) {
          this.showStatusMessage(result.error || this.$t('colorManagement.updateGroupFailed'), 'error')
          return
        }
        await this.loadAndProcessColorGroups()
        eventBus.emit(EVENT_TYPES.COLOR_GROUP_UPDATED, result.data)
        eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
        this.showStatusMessage(this.$t('colorManagement.colorRemovedFromGroupNamed', { name: group.name }), 'success')
      } catch (error) {
        console.error('remove color from group failed', error)
        this.showStatusMessage(error.message || this.$t('colorManagement.groupOperationFailed'), 'error')
      }
    },

    // 
    translateErrorMessage(errorMessage) {
      if (!errorMessage) return errorMessage
      
      // 
      const rgbPattern = /Color with RGB\((\d+),(\d+),(\d+)\) already exists/
      const match = errorMessage.match(rgbPattern)
      
      if (match) {
        const [, r, g, b] = match
        return this.$t('colorManagement.colorAlreadyExists', { r, g, b })
      }
      
      // 
      return errorMessage
    },

    // 
    showStatusMessage(message, type = 'info') {
      this.statusMessage = message
      setTimeout(() => {
        this.statusMessage = ''
      }, 3000)
    },
    async handleExport() {
      try {
        if (!this.colors.length) { this.showStatusMessage(this.$t('colorManagement.noColorsToExport'), 'warning'); return }
        const exportObj = { version:'1.0', exported_at:new Date().toISOString(), colors: this.colors.map(c=>({ id:c.id, name:c.name, rgb:{ r:c.rgb.r, g:c.rgb.g, b:c.rgb.b }, hex:c.hex, protected: !!c.protected, created_at: c.created_at || '', updated_at: c.updated_at || '' })) }
        const blob = new Blob([JSON.stringify(exportObj,null,2)], { type:'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `color-palettes-${new Date().toISOString().slice(0,10)}.json`
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
        this.showStatusMessage(this.$t('colorManagement.paletteExportedSuccess'), 'success')
      } catch(e){ console.error(e); this.showStatusMessage(this.$t('colorManagement.exportFailedMsg', { msg: e.message }), 'error') }
    },
    async handleImport() {
      const input = document.createElement('input')
      input.type = 'file'; input.accept = 'application/json'
      input.onchange = async () => {
        const file = input.files[0]; if(!file) return
        try {
          const text = await file.text()
          const json = JSON.parse(text)
          if (!json.colors || !Array.isArray(json.colors)) throw new Error(this.$t('colorManagement.badPaletteFile'))
          this.showStatusMessage(this.$t('colorManagement.importingPalettesOverwrite'), 'info')
          const res = await colorAPI.importColorPalettes({ colors: json.colors, preserveGroups: true }) // preserve existing groups
          if (res.success) {
            await this.loadColors()
            await this.loadAndProcessColorGroups()
            const { inserted, skipped, remappedGroups } = res.data.summary
            eventBus.emit(EVENT_TYPES.COLORS_CHANGED)
            eventBus.emit(EVENT_TYPES.COLOR_GROUPS_CHANGED)
            this.showStatusMessage(this.$t('colorManagement.importPalettesSummary', { inserted, skipped, remapped: remappedGroups }), 'success')
          } else { throw new Error(res.error) }
        } catch(e){ console.error(e); this.showStatusMessage(this.$t('colorManagement.importFailedMsg', { msg: e.message }), 'error') }
      }
      input.click()
    },
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  position: relative;
  background: white;
  border-radius: 12px;
  width: 90vw;
  height: 90vh;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  isolation: isolate;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #e9ecef;
  color: #333;
}

.modal-body {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: #fff;
  isolation: isolate;
}

.tab-navigation {
  display: flex;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
  color: #666;
}

.tab-item:hover {
  background: #e9ecef;
  color: #333;
}

.tab-item.active {
  background: white;
  color: #007ACC;
  border-bottom-color: #007ACC;
}

.tab-content {
  position: relative;
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  background: #fff;
  isolation: isolate;
}

.tab-panel {
  position: relative;
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  background: #fff;
}

.tab-panel > * {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.color-management-layout {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
  min-height: 0;
  background: #fff;
}

.left-section {
  position: relative;
  flex: 2;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.right-section {
  position: relative;
  flex: 0 0 320px;
  min-width: 320px;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
}

.groups-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.groups-placeholder h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.footer-left {
  flex: 1;
}

.status-text {
  color: #666;
  font-size: 14px;
}

.footer-right {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #666;
}

.btn-secondary:hover {
  background: #f0f6ff;
  border-color: #007ACC;
  color: #007ACC;
}

.btn-primary {
  background: #007ACC;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #005a9e;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}


.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.dialog {
  background: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.dialog-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.dialog-body {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #007ACC;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}


.dialog-large {
  width: 80vw;
  max-width: 800px;
  height: 70vh;
  display: flex;
  flex-direction: column;
}

.dialog-large .dialog-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.color-selection-info {
  padding-bottom: 16px;
  border-bottom: 1px solid #e1e5e9;
  margin-bottom: 16px;
}

.color-selection-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}


.selectable-color-card {
  position: relative;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  overflow: hidden;
}

.selectable-color-card:hover {
  border-color: #007ACC;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.15);
}

.selectable-color-card.selected {
  border-color: #007ACC;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
  transform: scale(1.02);
}

.selectable-color-card .color-swatch {
  width: 100%;
  height: 60px;
  border-bottom: 1px solid #e1e5e9;
}

.selectable-color-card .color-info {
  padding: 8px;
}

.selectable-color-card .color-name {
  font-weight: 500;
  font-size: 12px;
  margin-bottom: 4px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.selectable-color-card .color-code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  color: #666;
  font-weight: 500;
}

.selection-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: #007ACC;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #666;
}

.empty-state h5 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}


.color-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.color-input-group .form-input {
  flex: 1;
}

.color-preview {
  width: 40px;
  height: 40px;
  border: 1px solid #ddd;
  border-radius: 6px;
  flex-shrink: 0;
}
.selectable-color-card {
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 8px;
  text-align: center;
  cursor: pointer;
  transition: border 0.2s ease;
}

.selectable-color-card.selected {
  border: 2px solid #007bff; 
}

.color-swatch {
  width: 100%;
  height: 60px;
  border-radius: 4px;
}

.color-name {
  margin-top: 6px;
  font-size: 12px;
  color: #333;
  word-break: break-word;
}
.color-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); 
  gap: 12px; 
  max-height: 400px; 
  overflow-y: auto;
  padding: 8px;
}

</style>
