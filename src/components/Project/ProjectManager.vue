<template>
  <el-dialog
    v-model="visible"
    :title="t('projectManager.title')"
    width="1200px"
    destroy-on-close
    class="project-manager-dialog"
  >
    <el-tabs v-model="activeTab" tab-position="top" class="manager-tabs">
      <el-tab-pane name="create">
        <template #label>
          <span class="tab-label"><el-icon><document-add /></el-icon>{{ t('projectManager.tabCreate') }}</span>
        </template>
        
        <ProjectForm ref="formRef" @submit="handleCreate" />
      </el-tab-pane>
      
      <el-tab-pane name="xml">
        <template #label>
          <span class="tab-label"><el-icon><document /></el-icon>{{ t('projectManager.tabHistoryXml') }}</span>
        </template>
        <XmlSnapshotList @import-xml="onImportXml" />
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <div class="pm-footer" v-if="activeTab==='create'">
        <el-button @click="close">{{ t('projectManager.cancel') }}</el-button>
        <el-button type="primary" @click="submitCreate" :loading="creating">{{ t('projectManager.createProject') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script>
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import ProjectForm from './ProjectForm.vue'
import { Document, DocumentAdd } from '@element-plus/icons-vue'
import { useLocalProjects } from '../../composables/useLocalProjects.js'
import XmlSnapshotList from './XmlSnapshotList.vue'
import { readProjectXmlDisplay, readProjectXmlImageSize, readProjectXmlProjectName } from '../../utils/projectXml.js'
import {
  analyzeOriginalImageAgainstGrid,
  buildOriginalImageRecord,
  resolveImageIntrinsicSize
} from '../../utils/originalImageSemantics.js'

export default {
  name: 'ProjectManager',
  components: { ProjectForm, Document, DocumentAdd, XmlSnapshotList },
  props: { modelValue: { type: Boolean, default: false } },
  emits: ['update:modelValue', 'project-created', 'project-imported'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const visible = computed({ get:()=>props.modelValue, set:v=>emit('update:modelValue', v) })
    const activeTab = ref('create')

    const { create } = useLocalProjects()
    const creating = ref(false)
    const formRef = ref(null)
    const waitForFrame = () => new Promise(resolve => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve())
        return
      }
      setTimeout(resolve, 16)
    })

    function close() {
      visible.value = false
      activeTab.value = 'create'
    }
    function submitCreate(){ formRef.value?.submit?.() }

    async function handleCreate(data){
      creating.value = true
      try {
        const res = await create(data)
        if (res.success) {
          const createdProject = res.data
          ElMessage.success(t('projectManager.createOk'))
          close()
          await nextTick()
          await waitForFrame()
          emit('project-created', createdProject)
        } else {
          ElMessage.error(t('projectManager.createFail', { msg: res.error || t('merge.step4.errUnknown') }))
        }
      } catch (e) {
        ElMessage.error(t('projectManager.createFail', { msg: e?.message || t('merge.step4.errUnknown') }))
      } finally { creating.value = false }
    }

    async function onImportXml(payload){
      try {
        const base = payload.snapshot || {}
        const cellsMatrix = payload.cellsMatrix || payload.cells
        const rows = payload.rows || base.rows || base.height || 0
        const cols = payload.cols || base.cols || base.width || 0
        const displayConfig = base.xml_string ? readProjectXmlDisplay(base.xml_string) : null
        if(!Array.isArray(cellsMatrix) || !cellsMatrix.length){
          ElMessage.warning(t('projectManager.xmlNoCells'))
          return
        }
        //  base64 & 
        let originalBase64 = base.original_img || null
        let pixelW = base.pixel_width || base.image_width || 0
        let pixelH = base.pixel_height || base.image_height || 0
        if ((!originalBase64 || !pixelW || !pixelH) && base.xml_string) {
          try {
            const dom = new DOMParser().parseFromString(base.xml_string, 'application/xml')
            const node = dom.querySelector('Images > Original')
            const metaSize = readProjectXmlImageSize(base.xml_string)
            if (node) {
              const data = node.textContent || ''
              const mime = node.getAttribute('mime') || 'image/png'
              originalBase64 = data ? `data:${mime};base64,${data}` : originalBase64
            }
            pixelW = pixelW || metaSize.width || 0
            pixelH = pixelH || metaSize.height || 0
          } catch(e){ console.warn('[ProjectManager] parse original image failed', e) }
        }
        if (originalBase64) {
          const intrinsicSize = await resolveImageIntrinsicSize(originalBase64, {
            width: pixelW,
            height: pixelH
          })
          pixelW = intrinsicSize.width || pixelW
          pixelH = intrinsicSize.height || pixelH
        }
        const originalAnalysis = originalBase64
          ? await analyzeOriginalImageAgainstGrid({
              imageSrc: originalBase64,
              width: pixelW,
              height: pixelH,
              rows,
              cols,
              cellsMatrix
            })
          : null
        const imageObj = buildOriginalImageRecord({
          dataUrl: originalBase64,
          width: pixelW,
          height: pixelH,
          analysis: originalAnalysis
        })
        // 
        let id = Date.now()
        const importedName = readProjectXmlProjectName(base.xml_string) || base.project_name || base.name || 'XML'
        const tempProject = {
          name: importedName,
          grid: { length: cols, width: rows, cellSize: 1 },
          colorConfig: { type:'count', colorCount: base.palette_count || base.paletteCount || 0 },
          xmlSnapshot: base,
          cellsMatrix,
          rows,
          cols,
          image: imageObj,
          image_width: pixelW,
          image_height: pixelH,
          result: displayConfig ? { display: displayConfig } : null,
          id
        }
        emit('project-imported', tempProject)
        ElMessage.success(t('projectManager.xmlImportOk'))
        close()
      } catch(e){ console.warn('XML import failed', e); ElMessage.error(t('projectManager.xmlImportFail')) }
    }

    return { t, visible, activeTab, creating, formRef, close, submitCreate, handleCreate, onImportXml }
  }
}
</script>
<style scoped>
.manager-tabs { height:100%; }
.tab-label { display:flex; align-items:center; gap:6px; }
.history-wrapper { padding:16px; }
.history-header { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.history-list { min-height:300px; }
.empty { padding:40px; text-align:center; color:#909399; }
.pm-footer { display:flex; justify-content:flex-end; gap:12px; }
.rotate-180 { transform: rotate(180deg); transition: .2s; }
</style>
