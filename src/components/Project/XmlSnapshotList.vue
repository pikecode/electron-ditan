<template>
  <div class="xml-snapshot-list table-mode">
    <div class="header">
      <h3>{{ t('xmlSnapshot.title') }}</h3>
      <div class="actions">
        <el-button size="small" type="primary" @click="triggerImportXml" :title="t('xmlSnapshot.importXml')"><el-icon><upload-filled /></el-icon><span class="btn-text">{{ t('xmlSnapshot.importXml') }}</span></el-button>
        <el-button size="small" @click="refresh" :loading="loading" :title="t('xmlSnapshot.refresh')"><el-icon><refresh /></el-icon><span class="btn-text">{{ t('xmlSnapshot.refresh') }}</span></el-button>
        <el-button size="small" type="danger" @click="clearAll" :disabled="loading || snapshots.length===0" plain>{{ t('xmlSnapshot.clearAll') }}</el-button>
        <input ref="xmlFileInput" type="file" accept=".xml" style="display:none" @change="handleXmlFileSelect" />
      </div>
    </div>

    <div v-if="loading" class="loading"><el-icon class="is-loading"><loading /></el-icon>{{ t('xmlSnapshot.loading') }}</div>
    <div v-else-if="snapshots.length===0" class="empty">{{ t('xmlSnapshot.empty') }}</div>

    <el-table v-else :data="snapshots" size="small" border class="snapshot-table" @row-dblclick="(_,row)=>importSnapshot(row)">
      
      <el-table-column :label="t('xmlSnapshot.colImport')" width="90" align="center">
        <template #default="{ row }">
          <el-button size="small" type="success" @click="importSnapshot(row)">{{ t('xmlSnapshot.btnImport') }}</el-button>
        </template>
      </el-table-column>
      <el-table-column prop="project_name" :label="t('xmlSnapshot.colProject')" min-width="160" show-overflow-tooltip />
      <el-table-column prop="saved_at" :label="t('xmlSnapshot.colTime')" min-width="180">
        <template #default="{ row }">{{ formatDate(row.saved_at) }}</template>
      </el-table-column>
      <el-table-column :label="t('xmlSnapshot.colGridImg')" min-width="200">
        <template #default="{ row }">
          <div class="thumb-cell" v-if="row.grid_img">
            <img :src="row.grid_img" class="thumb-img" @click="openImage(row,'grid')" alt="grid" />
            <div class="thumb-actions">
              <el-button size="small" type="primary" @click="openImage(row,'grid')">{{ t('xmlSnapshot.view') }}</el-button>
              
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('xmlSnapshot.colOrig')" min-width="200">
        <template #default="{ row }">
          <div class="thumb-cell" v-if="row.original_img">
            <img :src="row.original_img" class="thumb-img" @click="openImage(row,'original')" alt="original" />
            <div class="thumb-actions">
              <el-button size="small" type="primary" @click="openImage(row,'original')">{{ t('xmlSnapshot.view') }}</el-button>
              
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('xmlSnapshot.colX')" min-width="200">
        <template #default="{ row }">
          <div class="thumb-cell" v-if="row.x_img">
            <img :src="row.x_img" class="thumb-img" @click="openImage(row,'x')" alt="x" />
            <div class="thumb-actions">
              <el-button size="small" type="primary" @click="openImage(row,'x')">{{ t('xmlSnapshot.view') }}</el-button>
              
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('xmlSnapshot.colMainColors')" min-width="220">
        <template #default="{ row }">
          <div class="colors-inline" v-if="row.colors_all?.length">
            <div class="ci" v-for="c in row.colors_all.slice(0, inlineColorLimit)" :key="c.hex" :title="c.hex + ' ' + c.count">
              <span class="sw" :style="{background:c.hex}"></span>
              <span class="pct">{{ c.count }}</span>
            </div>
            <el-button v-if="row.colors_all.length > inlineColorLimit" size="small" type="primary" text @click="openAllColors(row)">{{ t('xmlSnapshot.more', { n: row.colors_all.length }) }}</el-button>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('xmlSnapshot.colSize')" width="150" align="center">
        <template #default="{ row }">
          <div class="size-cell">
            <div class="size-grid"></div>
            <div class="size-lines">
              <span class="grid-size">{{ row.rows }}×{{ row.cols }} {{ t('xmlSnapshot.cellsUnit') }}</span>
              <span class="pixel-size" v-if="row.pixel_width && row.pixel_height">{{ row.pixel_width }}×{{ row.pixel_height }} px</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="xml_size" :label="t('xmlSnapshot.colFileSize')" width="90" align="center">
        <template #default="{ row }">{{ humanSize(row.xml_size) }}</template>
      </el-table-column>
      
      <el-table-column :label="t('xmlSnapshot.colActions')" width="140" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="downloadSingleXml(row)" :title="t('xmlSnapshot.exportXml')">{{ t('xmlSnapshot.exportXml') }}</el-button>
          <el-button size="small" type="danger" @click="remove(row)">{{ t('xmlSnapshot.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    
    <div v-if="totalSnapshots > 0" class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="totalSnapshots"
        layout="prev, pager, next, jumper, ->, total"
        @change="handlePageChange"
      />
    </div>

    <el-dialog v-model="imageDialogVisible" :title="imageDialogTitle" width="80%" top="40px" destroy-on-close>
      <div class="image-preview-container">
        
        <div class="image-controls">
          <div class="control-group">
            <label>{{ t('xmlSnapshot.previewSizeLabel') }}:</label>
            <el-input-number v-model="imagePreviewWidth" :min="50" :max="20000" size="small" style="width:100px; margin-right:8px;" />
            <span style="margin-right:12px;">×</span>
            <el-input-number v-model="imagePreviewHeight" :min="50" :max="20000" size="small" style="width:100px;" />
            <span style="margin-left:8px; color:#606266; font-size:12px;">px</span>
          </div>
          <div class="control-group">
            <el-checkbox v-model="enableBorder">{{ t('xmlSnapshot.previewAddBorder') }}</el-checkbox>
            <template v-if="enableBorder">
              <el-color-picker v-model="borderColor" size="small" style="margin:0 8px;" />
              <span style="margin-right:8px;">{{ t('xmlSnapshot.previewBorderWidth') }}:</span>
              <el-slider v-model="borderWidth" :min="1" :max="20" :step="1" style="width:120px; display:inline-block; margin-right:8px;" />
              <span style="color:#606266; font-size:12px; min-width:40px;">{{ borderWidth }}px</span>
            </template>
          </div>
        </div>
        
        <div class="image-dialog-body">
          <canvas ref="previewCanvas" :width="imagePreviewWidth" :height="imagePreviewHeight" class="preview-canvas" />
        </div>
      </div>
      <template #footer>
        <el-dropdown @command="f=>downloadRowImage(dialogRow,currentImageType,f)">
          <el-button type="primary"><el-icon><download /></el-icon>{{ t('xmlSnapshot.btnDownloadImage') }}</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="png">PNG</el-dropdown-item>
              <el-dropdown-item command="jpeg">JPEG</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="imageDialogVisible=false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="colorDialogVisible" :title="t('xmlSnapshot.allColorsTitle', { name: colorDialogRow?.project_name || t('xmlSnapshot.unnamedProject') })" width="600px" destroy-on-close>
      <div v-if="colorDialogRow?.colors_all?.length" class="all-colors-grid">
        <div class="all-color-item" v-for="c in colorDialogRow.colors_all" :key="c.hex">
          <span class="all-sw" :style="{background:c.hex}" />
          <span class="all-hex">{{ c.hex }}</span>
          <span class="all-count">{{ c.count }}</span>
        </div>
      </div>
      <div v-else class="empty-colors">{{ t('xmlSnapshot.noColorsInSnapshot') }}</div>
      <template #footer>
        <el-button @click="colorDialogVisible=false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading, Refresh, Download, Delete, View, UploadFilled } from '@element-plus/icons-vue'
import { isTransparentCellColor } from '../../core/cellState.js'
import { readProjectXmlProjectName } from '../../utils/projectXml.js'

export default {
  name: 'XmlSnapshotList',
  emits: ['import-xml'],
  setup(_, { emit }) {
    const { t, locale } = useI18n()
    const snapshots = ref([])
    const loading = ref(false)
    const imageDialogVisible = ref(false)
    const imageDialogSrc = ref('')
    const imageDialogTitle = ref('')
    const currentImageType = ref('')
    const dialogRow = ref(null)
    const previewCanvas = ref(null)
    const imagePreviewWidth = ref(400)
    const imagePreviewHeight = ref(400)
    const enableBorder = ref(false)
    const borderColor = ref('#0066FF')
    const borderWidth = ref(5)
    const colorDialogVisible = ref(false)
    const colorDialogRow = ref(null)
    const xmlFileInput = ref(null)
    const inlineColorLimit = 10
    
    // 
    const pageSize = 4
    const currentPage = ref(1)
    const totalSnapshots = ref(0)

    function formatDate(iso){
      if(!iso) return ''
      try {
        const d = new Date(iso)
        const tag = locale.value === 'zh' ? 'zh-CN' : 'en-US'
        return d.toLocaleString(tag, { hour12: false })
      } catch { return iso }
    }
    function humanSize(len){ if(!len) return '0B'; if(len<1024) return len+'B'; if(len<1024*1024) return (len/1024).toFixed(1)+'KB'; return (len/1024/1024).toFixed(2)+'MB' }

    //  =====================================
    function parseCellsObj(xml){
      try {
        const dom=new DOMParser().parseFromString(xml,'application/xml')
        const node=dom.querySelector('Cells')
        if(!node) return null
        const txt=node.textContent||''
        const obj=JSON.parse(txt)
        //  data: 
        const rows = obj.rows || obj.height || 0
        const cols = obj.cols || obj.width || 0
        let matrix = []
        if (Array.isArray(obj.data)) {
          if (rows && cols && Array.isArray(obj.data[0])) {
            // 
            matrix = obj.data
          } else if (rows && cols && obj.data.length === rows*cols) {
            // 
            for(let r=0;r<rows;r++){ matrix[r]=obj.data.slice(r*cols,(r+1)*cols) }
          } else {
            // 
            matrix = Array.isArray(obj.data[0]) ? obj.data : [obj.data]
          }
        }
        // 
        const flat = matrix.flat()
        obj._matrix = matrix
        obj._flat = flat
        obj._rows = rows
        obj._cols = cols
        return obj
      } catch{ return null }
    }
    function extractOriginalBase64(xml){
      try { const dom=new DOMParser().parseFromString(xml,'application/xml'); const node=dom.querySelector('Images > Original'); if(!node) return ''; const mime=node.getAttribute('mime')||'image/png'; const data=node.textContent||''; if(!data) return ''; return `data:${mime};base64,${data}` } catch { return '' }
    }
    function parseOriginalSize(xml){
      try { const dom=new DOMParser().parseFromString(xml,'application/xml'); const node=dom.querySelector('Images > Original'); const meta=dom.querySelector('Meta'); return { width: Number(node?.getAttribute('width') || meta?.getAttribute('imageWidth'))||null, height: Number(node?.getAttribute('height') || meta?.getAttribute('imageHeight'))||null } } catch { return { width:null,height:null } }
    }
    function extractXBase64(xml){
      try { const dom=new DOMParser().parseFromString(xml,'application/xml'); const node=dom.querySelector('Images > XPNG'); if(!node) return ''; const mime=node.getAttribute('mime')||'image/png'; const data=node.textContent||''; if(!data) return ''; return `data:${mime};base64,${data}` } catch { return '' }
    }
    function extractFullGridBase64(xml){
      try { const dom=new DOMParser().parseFromString(xml,'application/xml'); const node=dom.querySelector('Images > FullPNG'); if(!node) return ''; const mime=node.getAttribute('mime')||'image/png'; const data=node.textContent||''; if(!data) return ''; return `data:${mime};base64,${data}` } catch { return '' }
    }
    function extractFullFromCells(xml){
      try { const obj=parseCellsObj(xml); if(!obj) return ''; const rows=obj.rows||obj.height||0; const cols=obj.cols||obj.width||0; const dataArr=obj.data||[]; if(!rows||!cols||!dataArr.length) return ''; const cellSize=4; const canvas=document.createElement('canvas'); canvas.width=cols*cellSize; canvas.height=rows*cellSize; const ctx=canvas.getContext('2d'); for(let r=0;r<rows;r++){ for(let c=0;c<cols;c++){ const idx=r*cols+c; const cell=dataArr[idx]; const hex=(cell?.hex||cell?.color||'#FFFFFF'); ctx.fillStyle=hex; ctx.fillRect(c*cellSize,r*cellSize,cellSize,cellSize) } } return canvas.toDataURL('image/png') } catch { return '' }
    }
    // =====================================================================

    async function refresh(){
      loading.value = true
      try {
        const mod = await import('../../database/indexeddb/xmlSnapshotStore.js')
        let allList = await mod.listXmlSnapshots() || []
        totalSnapshots.value = allList.length
        
        // 
        allList = allList.sort((a,b)=> b.saved_at.localeCompare(a.saved_at))
        
        // 
        const start = (currentPage.value - 1) * pageSize
        const end = start + pageSize
        const pageList = allList.slice(start, end).map(row => enrichRow(row))
        
        snapshots.value = pageList
      } catch(e){ console.warn('load xml snapshots', e); ElMessage.error(t('xmlSnapshot.msgLoadFail')) }
      finally { loading.value = false }
    }
    
    function handlePageChange(newPage){
      currentPage.value = newPage
      refresh()
    }
    function enrichRow(row){
      row.grid_img = extractFullGridBase64(row.xml_string) || extractFullFromCells(row.xml_string)
      row.original_img = extractOriginalBase64(row.xml_string)
      row.x_img = extractXBase64(row.xml_string)
      const sizeMeta = parseOriginalSize(row.xml_string)
      row.pixel_width = sizeMeta.width
      row.pixel_height = sizeMeta.height
      const statsObj = computeColorStats(row.xml_string)
      row.colors_all = statsObj.list // 
      row.top_colors = statsObj.list.slice(0,5) // 5
      row.total_cells = statsObj.totalCells
      row.cells_matrix = statsObj.matrix
      row.cells_flat = statsObj.flat
      row.rows = statsObj.matrix.length || 0
      row.cols = statsObj.matrix[0]?.length || 0
      //  xml_size 
      if(!row.xml_size && row.xml_string){
        row.xml_size = row.xml_string.length
      }
      return row
    }

    async function remove(row){
      try { await ElMessageBox.confirm(t('xmlSnapshot.confirmDeleteOne'), t('common.confirm'), { type: 'warning' })
        const mod = await import('../../database/indexeddb/xmlSnapshotStore.js')
        await mod.deleteXmlSnapshot(row.saved_at)
        ElMessage.success(t('xmlSnapshot.msgDeleted'))
        totalSnapshots.value--
        // 
        if(snapshots.value.length <= 1 && currentPage.value > 1){
          currentPage.value--
        }
        refresh()
      } catch(e){ if(e!=='cancel') console.warn(e) }
    }
    async function clearAll(){
      try { await ElMessageBox.confirm(t('xmlSnapshot.confirmClearAll'), t('common.confirm'), { type: 'warning' })
        const mod = await import('../../database/indexeddb/xmlSnapshotStore.js')
        await mod.clearXmlSnapshots()
        ElMessage.success(t('xmlSnapshot.msgCleared'))
        snapshots.value = []
        currentPage.value = 1
        totalSnapshots.value = 0
      } catch(e){ if(e!=='cancel') console.warn(e) }
    }
    function importSnapshot(row){
      const statsObj = computeColorStats(row.xml_string)
      emit('import-xml',{ snapshot:row, cellsMatrix: statsObj.matrix, cellsFlat: statsObj.flat, rows: statsObj.matrix.length, cols: statsObj.matrix[0]?.length || 0 })
      ElMessage.success(t('xmlSnapshot.msgImported'))
    }

    function openImage(row,type){ 
      currentImageType.value=type
      if(type==='grid') { imageDialogTitle.value=t('xmlSnapshot.titlePreviewGrid'); imageDialogSrc.value=row.grid_img }
      else if(type==='x') { imageDialogTitle.value=t('xmlSnapshot.titlePreviewX'); imageDialogSrc.value=row.x_img }
      else { imageDialogTitle.value=t('xmlSnapshot.titlePreviewOriginal'); imageDialogSrc.value=row.original_img }
      dialogRow.value=row
      enableBorder.value=true
      borderColor.value='#0066FF'
      borderWidth.value=5
      imagePreviewWidth.value=400
      imagePreviewHeight.value=400
      // 
      const img = new Image()
      img.onload = ()=>{ imagePreviewWidth.value=img.naturalWidth; imagePreviewHeight.value=img.naturalHeight; nextTick(()=>drawImageOnCanvas()) }
      img.src=imageDialogSrc.value
      imageDialogVisible.value=true
    }
    function openAllColors(row){ colorDialogRow.value = row; colorDialogVisible.value = true }

    function drawImageOnCanvas(){
      if(!previewCanvas.value || !imageDialogSrc.value) return
      const canvas = previewCanvas.value
      const ctx = canvas.getContext('2d')
      if(!ctx) return
      const img = new Image()
      img.onload = ()=>{
        // 
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        //  canvas 
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // 
        if(enableBorder.value){
          ctx.strokeStyle = borderColor.value
          ctx.lineWidth = borderWidth.value
          ctx.strokeRect(borderWidth.value/2, borderWidth.value/2, canvas.width - borderWidth.value, canvas.height - borderWidth.value)
        }
      }
      img.src = imageDialogSrc.value
    }

    function downloadRowImage(row,type,format){ 
      let src = type==='grid'? row.grid_img : type==='x' ? row.x_img : row.original_img
      if(!src) return
      //  canvas 
      const img=new Image()
      img.onload=()=>{
        const canvas=document.createElement('canvas')
        // 
        canvas.width=imagePreviewWidth.value
        canvas.height=imagePreviewHeight.value
        const ctx=canvas.getContext('2d')
        ctx.drawImage(img,0,0,canvas.width,canvas.height)
        //  canvas 
        if(enableBorder.value){
          ctx.strokeStyle = borderColor.value
          ctx.lineWidth = borderWidth.value
          ctx.strokeRect(borderWidth.value/2, borderWidth.value/2, canvas.width - borderWidth.value, canvas.height - borderWidth.value)
        }
        if(format==='png'){ triggerDownload(canvas.toDataURL('image/png'), `${row.project_name||'image'}_${type}.png`); return }
        const jpeg=canvas.toDataURL('image/jpeg',0.92)
        triggerDownload(jpeg, `${row.project_name||'image'}_${type}.jpg`)
      }
      img.src=src
    }
    function triggerDownload(dataUrl, filename){ const a=document.createElement('a'); a.href=dataUrl; a.download=filename; a.click() }

    function computeColorStats(xml){
      const obj=parseCellsObj(xml); if(!obj) return { list:[], totalCells:0, matrix:[], flat:[] }
      const rows=obj._rows||0; const cols=obj._cols||0; const flat=obj._flat||[]
      const total= rows*cols || flat.length
      const map=new Map()
      for(const cell of flat){ const hex=(cell?.hex||cell?.color||'').toUpperCase(); if(!hex || isTransparentCellColor(hex)) continue; map.set(hex,(map.get(hex)||0)+1) }
      const list=Array.from(map.entries()).map(([hex,count])=>({hex,count})).sort((a,b)=>b.count-a.count)
      return { list, totalCells: total, matrix: obj._matrix, flat }
    }

    //  XML 
    function triggerImportXml(){
      xmlFileInput.value?.click()
    }
    async function handleXmlFileSelect(e){
      const file = e.target.files[0]
      if(!file) return
      if(!file.name.endsWith('.xml')){
        ElMessage.error(t('xmlSnapshot.errPickXml'))
        return
      }
      try {
        const xmlString = await file.text()
        //  XML 
        const projectName = readProjectXmlProjectName(xmlString) || file.name.replace('.xml', '')
        
        // 
        const mod = await import('../../database/indexeddb/xmlSnapshotStore.js')
        const timestamp = new Date().toISOString()
        await mod.saveXmlSnapshot({
          project_name: projectName,
          xml_string: xmlString,
          saved_at: timestamp,
          xml_size: xmlString.length
        })
        
        ElMessage.success(t('xmlSnapshot.importFileOk', { name: projectName }))
        currentPage.value = 1
        refresh()
      } catch(err){
        console.error('import XML fail', err)
        ElMessage.error(t('xmlSnapshot.importFileFail', { msg: err.message }))
      } finally {
        if(xmlFileInput.value) xmlFileInput.value.value = ''
      }
    }

    //  XML
    function exportAllXml(){
      if(snapshots.value.length === 0){
        ElMessage.warning(t('xmlSnapshot.warnNoExport'))
        return
      }
      try {
        snapshots.value.forEach((snapshot, index) => {
          const fileName = `${snapshot.project_name || 'snapshot_' + index}.xml`
          downloadXmlFile(snapshot.xml_string, fileName)
        })
        ElMessage.success(t('xmlSnapshot.exportOkCount', { n: snapshots.value.length }))
      } catch(err){
        console.error('export fail', err)
        ElMessage.error(t('xmlSnapshot.exportFail', { msg: err.message }))
      }
    }

    function downloadXmlFile(xmlString, fileName){
      const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }

    function downloadSingleXml(row){
      if(!row.xml_string){
        ElMessage.error(t('xmlSnapshot.errXmlEmpty'))
        return
      }
      const fileName = `${row.project_name || 'snapshot'}.xml`
      downloadXmlFile(row.xml_string, fileName)
    }

    // 
    watch([imagePreviewWidth, imagePreviewHeight, enableBorder, borderColor, borderWidth], ()=>{ if(imageDialogVisible.value) nextTick(()=>drawImageOnCanvas()) }, { immediate:false })

    onMounted(refresh)
    return { t, snapshots, loading, refresh, remove, clearAll, importSnapshot, formatDate, humanSize, openImage, downloadRowImage, imageDialogVisible, imageDialogSrc, imageDialogTitle, currentImageType, dialogRow, colorDialogVisible, colorDialogRow, openAllColors, inlineColorLimit, xmlFileInput, triggerImportXml, handleXmlFileSelect, downloadSingleXml, currentPage, pageSize, totalSnapshots, handlePageChange, previewCanvas, imagePreviewWidth, imagePreviewHeight, enableBorder, borderColor, borderWidth }
  }
}
</script>
<style scoped>
.table-mode { display:flex; flex-direction:column; gap:12px; }
.header { display:flex; justify-content:space-between; align-items:center; }
.header h3 { margin:0; font-size:16px; font-weight:600; }
.actions { display:flex; gap:8px; }
.loading,.empty { padding:40px 0; text-align:center; color:#909399; }
.snapshot-table { background:#fff; }
.thumb-cell { display:flex; align-items:center; gap:10px; }
.thumb-img { width:80px; height:80px; object-fit:cover; border:1px solid #ebeef5; border-radius:6px; cursor:zoom-in; background:#fafafa; }
.thumb-actions { display:flex; flex-direction:column; gap:4px; }
.colors-inline { display:flex; flex-wrap:wrap; gap:6px; }
.ci { display:flex; align-items:center; gap:4px; font-size:11px; background:#fff; border:1px solid #ebeef5; padding:2px 6px; border-radius:4px; }

.sw { width:16px; height:16px; border:1px solid #dcdfe6; border-radius:4px; display:inline-block; }

.all-colors-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(120px,1fr)); gap:8px; max-height:360px; overflow:auto; }
.all-color-item { display:flex; align-items:center; gap:6px; background:#fff; border:1px solid #ebeef5; padding:6px 8px; border-radius:6px; font-size:12px; }
.all-sw { width:18px; height:18px; border:1px solid #dcdfe6; border-radius:4px; }
.all-hex { font-weight:600; }
.all-count { color:#606266; margin-left:auto; }
.empty-colors { padding:30px; text-align:center; color:#909399; }
.btn-text { margin-left:4px; }
.image-preview-container { display:flex; flex-direction:column; gap:16px; }
.image-controls { display:flex; flex-wrap:wrap; gap:16px; padding:12px; background:#f5f7fa; border-radius:6px; }
.control-group { display:flex; align-items:center; gap:8px; }
.image-dialog-body { display:flex; justify-content:center; align-items:center; background:#000; padding:10px; border-radius:8px; max-height:60vh; overflow:auto; }
.preview-canvas { max-width:100%; max-height:60vh; object-fit:contain; border:1px solid #e4e7ed; border-radius:4px; }
.size-cell { display:flex; align-items:center; gap:8px; justify-content:center; }
.size-grid { width:32px; height:32px; background:repeating-linear-gradient(0deg,#ddd 0,#ddd 1px,transparent 1px,transparent 5px),repeating-linear-gradient(90deg,#ddd 0,#ddd 1px,transparent 1px,transparent 5px); border:1px solid #ccc; border-radius:4px; flex-shrink:0; }
.size-lines { display:flex; flex-direction:column; align-items:flex-start; gap:2px; }
.grid-size { font-size:12px; font-weight:600; color:#303133; }
.pixel-size { font-size:11px; color:#606266; }
/* ...existing code... */
:deep(.el-table th){ background:#f8f9fa; }
.pagination-wrapper { display:flex; justify-content:flex-end; margin-top:12px; padding:8px 0; }
</style>
