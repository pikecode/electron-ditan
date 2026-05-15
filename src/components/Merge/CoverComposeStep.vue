<template>
  <div class="cover-compose-root">
    
    <div v-if="!selectedCoverId" class="select-overlay">
      <div class="select-box">
        <h2>{{ tr('merge.step4.overlayTitle') }}</h2>
        <p class="sub">{{ tr('merge.step4.overlaySub') }}</p>
        <el-button type="primary" size="large" @click="openCoverDialog">{{ tr('merge.step4.pickCoverBtn') }}</el-button>
      </div>
    </div>

    
    <div v-else class="editor-layout">
      <header class="topbar">
        <div class="left-group">
          
          
          <el-button size="small" @click="addText" :disabled="!coverImgLoaded">{{ activeSide==='front'? tr('merge.step4.addTextFront'): tr('merge.step4.addTextBack') }}</el-button>
          <el-button size="small" :type="brushMode? 'primary':''" @click="toggleBrushMode" :disabled="!coverImgLoaded">{{ brushMode? tr('merge.step4.brushExit'): (activeSide==='front'? tr('merge.step4.brushFront'): tr('merge.step4.brushBack')) }}</el-button>
        </div>
        <div class="center-title">
          {{ tr('merge.step4.titleBar', { name: currentCoverName || tr('merge.step4.coverComposeDefault') }) }}
        </div>
        <div class="right-group">
          <el-button size="small" type="primary" @click="exportImage('png')" :disabled="!coverImgLoaded">{{ tr('merge.step4.exportPng') }}</el-button>
          <el-button size="small" type="primary" @click="exportImage('jpeg')" :disabled="!coverImgLoaded">{{ tr('merge.step4.exportJpeg') }}</el-button>
          <el-button size="small" type="primary" @click="openExportDialog" :disabled="!coverImgLoaded">{{ tr('merge.step4.export') }}</el-button>
          <el-button size="small" @click="goStep(3)">{{ tr('merge.step4.backToStep3') }}</el-button>
        </div>
      </header>
      <div class="stage-toolbar">
        <div class="stage-toolbar-left">
          <div class="side-switcher">
            <el-button
              :type="activeSide==='front'? 'primary':''"
              size="default"
              @click="switchToFront"
              class="side-btn"
            >
              {{ tr('merge.step4.btnFront') }}
            </el-button>
            <el-button
              :type="activeSide==='back'? 'primary':''"
              size="default"
              @click="switchToBack"
              class="side-btn"
            >
              {{ tr('merge.step4.btnBack') }}
            </el-button>
          </div>
        </div>
        <div class="stage-toolbar-right" v-if="coverImgLoaded">
          <div class="view-actions">
            <el-button size="small" :type="viewScaleMode==='auto' ? 'primary' : ''" @click="useFitViewScale">
              {{ tr('merge.step4.fitView') }}
            </el-button>
            <el-button size="small" :type="isViewScaleNear(1) ? 'primary' : ''" @click="setManualViewScale(1)">100%</el-button>
            <el-button size="small" :type="isViewScaleNear(1.5) ? 'primary' : ''" @click="setManualViewScale(1.5)">150%</el-button>
            <div class="zoom-stepper" aria-label="preview zoom controls">
              <button type="button" class="zoom-stepper-btn" @click="nudgeViewScale(-0.15)" aria-label="zoom out">-</button>
              <div class="zoom-stepper-value">{{ viewScalePercent }}%</div>
              <button type="button" class="zoom-stepper-btn" @click="nudgeViewScale(0.15)" aria-label="zoom in">+</button>
            </div>
            <el-button
              v-if="activeSide==='back' && tableObj"
              size="small"
              type="primary"
              plain
              @click="focusTableView"
            >
              {{ tr('merge.step4.focusTable') }}
            </el-button>
          </div>
        </div>
      </div>
      <div class="work-area">
        
        <aside class="side-left">
          <div class="panel-title">
            {{ tr('merge.step4.objectList', { side: activeSide==='front'? tr('merge.step4.sideFront'): tr('merge.step4.sideBack') }) }}
            <span class="side-hint">({{ activeSide==='front'? tr('merge.step4.hintFrontLayers'): tr('merge.step4.hintBackLayers') }})</span>
          </div>
          <ul class="object-list" v-if="activeSide==='front'">
            
            <li v-if="mergedBitmap" :class="{act: activeMerge}" @click="activateMerge">{{ tr('merge.step4.layerMerged') }}</li>
            <li v-for="txt in texts" :key="txt.id" :class="{act: activeTextId===txt.id}" @click="setActiveText(txt.id)">{{ txt.text || tr('merge.step4.placeholderText') }}</li>
            <li v-if="strokes.length>0" :class="{act: activeStrokeLayer}" @click="activateStrokeLayer">{{ tr('merge.step4.strokesLabel') }} {{ strokes.length? '('+strokes.length+')':'' }}</li>
          </ul>
          <ul class="object-list" v-else>
            
            <li v-if="gridObj" :class="{act: activeGrid}" @click="activateGrid">{{ tr('merge.step4.layerGrid') }}</li>
            <li v-if="tableObj" :class="{act: activeTable}" @click="activateTable">{{ tr('merge.step4.layerTable') }}</li>
            <li v-for="txt in backTexts" :key="txt.id" :class="{act: backActiveTextId===txt.id}" @click="setActiveBackText(txt.id)">{{ txt.text || tr('merge.step4.placeholderText') }}</li>
            <li v-if="backStrokes.length>0" :class="{act: activeStrokeLayer}" @click="activateStrokeLayer">{{ tr('merge.step4.strokesLabel') }} {{ backStrokes.length? '('+backStrokes.length+')':'' }}</li>
          </ul>
          <div v-if="activeSide==='front' && !mergedBitmap && texts.length===0" class="placeholder">{{ tr('merge.step4.placeholderEmpty') }}</div>
          <div v-else-if="activeSide==='back' && hasBackPlacementIssue" class="placeholder">
            <p>{{ tr('merge.step4.backPlacementsMissingTitle') }}</p>
            <p>{{ tr('merge.step4.backPlacementsMissingBody', { items: backPlacementMissingLabels }) }}</p>
          </div>
          <div v-else-if="activeSide==='back' && !gridObj && !tableObj && !backTexts.length" class="placeholder">
            <div v-if="!cellsData?.value && !selectedProject?.result?.cells" class="no-cells-hint">
              <p>{{ tr('merge.step4.noCellsTitle') }}</p>
              <el-button size="small" type="primary" @click="goStep(1)">{{ tr('merge.step4.goStep1Import') }}</el-button>
            </div>
            <div v-else>{{ tr('merge.step4.gridBuilding') }}</div>
          </div>
        </aside>
        
        <main class="canvas-zone">
          <div v-if="!coverImgLoaded" class="hint">{{ tr('merge.step4.loadingCoverHint') }}</div>
          <div v-else class="canvas-viewport" ref="zoneRef">
            <div class="canvas-wrapper" :class="{ 'canvas-wrapper--manual-zoom': viewScaleMode==='manual' }" ref="wrapperRef">
              <canvas
                ref="canvasRef"
                class="main-canvas"
                :style="canvasViewStyle"
                :class="{'dragging-merge': draggingMerge, 'brush-mode': brushMode}"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointerleave="onPointerLeave"
              @wheel="onCanvasWheel"
            ></canvas>
              <div v-if="activeSide==='back' && hasBackPlacementIssue" class="back-placeholder">
                <div class="back-placeholder-title">{{ tr('merge.step4.backPlacementsMissingTitle') }}</div>
                <div>{{ tr('merge.step4.backPlacementsMissingBody', { items: backPlacementMissingLabels }) }}</div>
              </div>
            </div>
          </div>
        </main>
        
        <aside class="side-right">
          <el-tabs v-model="propTab" class="prop-tabs" stretch>
            <el-tab-pane :label="tr('merge.step4.tabObject')" name="obj">
              <div class="prop-group">
                <template v-if="activeSide==='front' && activeMerge">
                  
                  <div class="kv"><span>X</span><span>{{ mergeLayer.x.toFixed(0) }}</span></div>
                  <div class="kv"><span>Y</span><span>{{ mergeLayer.y.toFixed(0) }}</span></div>
                  <div class="slider-row">
                    <label>{{ tr('merge.step4.scaleLabel', { v: mergeLayer.scale.toFixed(2) }) }}</label>
                    <el-slider :min="0.05" :max="4" :step="0.01" v-model="mergeLayer.scale" @input="onScaleInput" @change="onScaleInput" />
                    <div class="row2">
                      <el-button size="small" @click="nudgeScale(1/1.05)">-</el-button>
                      <el-button size="small" @click="nudgeScale(1.05)">+</el-button>
                    </div>
                  </div>
                  <div class="slider-row">
                    <label>{{ tr('merge.step4.angleLabel', { deg: Math.round(mergeLayer.rotate)||0 }) }}</label>
                    <el-slider :min="0" :max="360" :step="1" v-model="mergeLayer.rotate" @input="onRotateInput" @change="onRotateChange" />
                  </div>
                </template>
                <template v-else-if="activeSide==='back' && activeGrid">
                  <div class="kv"><span>X</span><span>{{ gridLayer.x.toFixed(0) }}</span></div>
                  <div class="kv"><span>Y</span><span>{{ gridLayer.y.toFixed(0) }}</span></div>
                  <div class="slider-row">
                    <label>{{ tr('merge.step4.scaleLabel', { v: gridLayer.scale.toFixed(2) }) }}</label>
                    <el-slider :min="0.2" :max="10" :step="0.01" v-model="gridLayer.scale" @change="regenerateGrid" />
                  </div>
                  <div class="slider-row">
                    <label>{{ tr('merge.step4.angleLabel', { deg: Math.round(gridLayer.rotate)||0 }) }}</label>
                    <el-slider :min="0" :max="360" :step="1" v-model="gridLayer.rotate" @input="onGridRotateInput" @change="onGridRotateChange" />
                  </div>
                </template>
                <template v-else-if="activeSide==='back' && activeTable">
                  <div class="kv"><span>X</span><span>{{ tableLayer.x.toFixed(0) }}</span></div>
                  <div class="kv"><span>Y</span><span>{{ tableLayer.y.toFixed(0) }}</span></div>
                  <div class="slider-row">
                    <label>{{ tr('merge.step4.scaleLabel', { v: tableLayer.scale.toFixed(2) }) }}</label>
                    <el-slider :min="0.2" :max="10" :step="0.01" v-model="tableLayer.scale" @change="regenerateTable" />
                  </div>
                  <div class="slider-row">
                    <label>{{ tr('merge.step4.tableCountLabel', { n: tableCount }) }}</label>
                    <el-slider :min="1" :max="3" :step="1" v-model="tableCount" />
                    <div class="row2">
                      <el-button size="small" @click="tableCount = Math.max(1, tableCount - 1)">-</el-button>
                      <el-button size="small" @click="tableCount = Math.min(3, tableCount + 1)">+</el-button>
                    </div>
                  </div>
                  
                  <div class="slider-row">
                    <label>{{ tr('merge.step4.angleLabel', { deg: Math.round(tableLayer.rotate)||0 }) }}</label>
                    <el-slider :min="0" :max="360" :step="1" v-model="tableLayer.rotate" @input="onTableRotateInput" @change="onTableRotateChange" />
                  </div>
                </template>
                <template v-else-if="currentActiveText">
                  <div class="field-row"><label class="field-label">{{ tr('merge.step4.textContent') }}</label><el-input ref="textInputRef" v-model="currentActiveText.text" size="small" @input="onCurrentTextChange" /></div>
                  <div class="kv"><span>{{ tr('merge.step4.position') }}</span><span>{{ formatTextPosition(currentActiveText) }}</span></div>
                  <div class="field-row">
                    <label class="field-label">{{ tr('merge.step4.position') }}</label>
                    <div class="coord-inputs">
                      <div class="coord-item">
                        <span class="coord-label">{{ tr('merge.step4.coordX') }}</span>
                        <el-input-number v-model="currentTextCoordX" :step="1" :precision="0" size="small" />
                      </div>
                      <div class="coord-item">
                        <span class="coord-label">{{ tr('merge.step4.coordY') }}</span>
                        <el-input-number v-model="currentTextCoordY" :step="1" :precision="0" size="small" />
                      </div>
                    </div>
                  </div>
                  <div class="slider-row"><label>{{ tr('merge.step4.fontSizeLabel', { n: currentActiveText.fontSize }) }}</label><el-slider :min="8" :max="500" :step="1" v-model="currentActiveText.fontSize" @input="onCurrentTextChange" /></div>
                  <div class="slider-row"><label>{{ tr('merge.step4.angleLabel', { deg: Math.round(currentActiveText.rotate)||0 }) }}</label><el-slider :min="0" :max="360" :step="1" v-model="currentActiveText.rotate" @input="onCurrentTextChange" /></div>
                  <div class="color-row"><label>{{ tr('merge.step4.color') }}</label><el-color-picker v-model="currentActiveText.color" size="small" @change="onCurrentTextChange" /><el-button size="small" @click="toggleCurrentTextBold" :type="currentActiveText.weight==='bold'?'primary':''">{{ tr('merge.step4.bold') }}</el-button><el-button size="small" type="danger" @click="removeCurrentText">{{ tr('merge.step4.del') }}</el-button></div>
                </template>
                <template v-else-if="activeStrokeLayer">
                  <div class="kv"><span>{{ tr('merge.step4.strokeCount') }}</span><span>{{ currentStrokes.length }}</span></div>
                  <div class="slider-row"><label>{{ tr('merge.step4.brushSizeLabel', { n: brushSize }) }}</label><el-slider :min="1" :max="120" :step="1" v-model="brushSize" /></div>
                  <div class="color-row"><label>{{ tr('merge.step4.color') }}</label><el-color-picker v-model="brushColor" size="small" /><el-button size="small" @click="toggleBrushMode" :type="brushMode? 'primary':''">{{ brushMode? tr('merge.step4.drawingOn'): tr('merge.step4.drawingStart') }}</el-button></div>
                  <div class="row2"><el-button size="small" @click="clearCurrentStrokes" :disabled="currentStrokes.length===0">{{ tr('merge.step4.clearStrokes') }}</el-button></div>
                </template>
                <div v-else class="empty-prop">{{ tr('merge.step4.emptySelection') }}</div>
              </div>
            </el-tab-pane>
            <el-tab-pane :label="tr('merge.step4.tabCanvas')" name="canvas">
              <div class="prop-group small">
                <el-button size="small" @click="resetMergePos" :disabled="!coverImgLoaded || !mergedBitmap">{{ tr('merge.step4.resetMergePos') }}</el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </aside>
      </div>
    </div>

    
    <el-dialog v-model="coverDialogVisible" width="900px" :close-on-click-modal="false" class="cover-dialog">
      <template #header><span>{{ tr('merge.step4.dialogPickCover') }}</span></template>
      <div class="cover-list-wrapper" v-loading="loadingCovers">
        <div class="dialog-toolbar">
          <el-input v-model="searchQuery" size="small" :placeholder="tr('merge.step4.searchNamePh')" clearable class="search-input" />
          <el-button size="small" @click="refreshCovers">{{ tr('merge.step4.refresh') }}</el-button>
        </div>
        <div class="cover-list-head">
          <div class="h-name">{{ tr('merge.step4.colName') }}</div>
          <div class="h-front">{{ tr('merge.step4.colFront') }}</div>
          <div class="h-back">{{ tr('merge.step4.colBack') }}</div>
          <div class="h-id">{{ tr('merge.step4.colId') }}</div>
        </div>
        <div class="cover-list" v-if="filteredCovers.length">
          <div class="cover-row" v-for="c in filteredCovers" :key="c.id" :class="{sel: coverCandidateId===c.id}" @click="selectCoverRow(c)">
            <div class="c-name" :title="c.name">{{ c.name || tr('merge.step4.unnamed') }}</div>
            <div class="c-front">
              <div class="mini-thumb" v-if="c.frontThumb"><img class="thumb-img" :src="c.frontThumb" @click.stop="openPreview(c,'front')" :alt="tr('merge.step4.altFront', { name: c.name || '' })" /></div>
              <div class="mini-thumb placeholder" v-else></div>
            </div>
            <div class="c-back">
              <div class="mini-thumb" v-if="c.backThumb"><img class="thumb-img" :src="c.backThumb" @click.stop="openPreview(c,'back')" :alt="tr('merge.step4.altBack', { name: c.name || '' })" /></div>
              <div class="mini-thumb placeholder" v-else></div>
            </div>
            <div class="c-id">{{ formatCoverId(c.id) }}</div>
          </div>
        </div>
        <div v-else class="empty">{{ tr('merge.step4.noCoverMatch') }}</div>
      </div>
      <template #footer>
        <el-button @click="coverDialogVisible=false">{{ tr('merge.step4.cancel') }}</el-button>
        <el-button type="primary" :disabled="!coverCandidateId" @click="confirmSelectCover">{{ tr('merge.step4.enterWork') }}</el-button>
      </template>
    </el-dialog>

    
    <el-dialog v-model="previewVisible" width="fit-content" :show-close="true" class="preview-dialog">
      <template #header>{{ previewTitle }}</template>
      <div class="preview-box" v-if="previewImage"><img :src="previewImage" class="preview-large" /></div>
    </el-dialog>

    
    <el-dialog v-model="pdfDialogVisible" width="1000px" :close-on-click-modal="false" class="pdf-dialog">
      <template #header>{{ tr('merge.step4.pdfPreviewTitle') }}</template>
      <div class="pdf-toolbar">
        <el-radio-group v-model="pdfPaper" size="small">
          <el-radio-button label="A4">A4</el-radio-button>
          <el-radio-button label="A3">A3</el-radio-button>
        </el-radio-group>
        <el-tooltip placement="top" :content="tr('merge.step4.pdfAutoTooltip')">
          <span class="auto-hint">{{ tr('merge.step4.pdfAuto') }}</span>
        </el-tooltip>
        <span class="paper-info">{{ tr('merge.step4.pdfCurrent', { paper: pdfPaper }) }}</span>
      </div>
      <div class="pdf-preview-wrapper" v-loading="pdfLoading">
        <div class="page-preview" v-if="pdfFrontData">
          <div class="tools"><span>{{ tr('merge.step4.btnFront') }}</span><el-button size="small" @click="rotateFront">{{ tr('merge.step4.rotate90') }}</el-button></div>
          <div class="img-box"><img :src="pdfFrontData" :style="pageStyle(pdfFrontRotate)" /></div>
        </div>
        <div class="page-preview" v-if="pdfBackData">
          <div class="tools"><span>{{ tr('merge.step4.btnBack') }}</span><el-button size="small" @click="rotateBack">{{ tr('merge.step4.rotate90') }}</el-button></div>
          <div class="img-box"><img :src="pdfBackData" :style="pageStyle(pdfBackRotate)" /></div>
        </div>
        <div v-if="!pdfLoading && (!pdfFrontData || !pdfBackData)" class="empty">{{ tr('merge.step4.pdfNotReady') }}</div>
      </div>
      <template #footer>
        <el-button @click="pdfDialogVisible=false" :disabled="pdfLoading">{{ tr('merge.step4.cancel') }}</el-button>
        <el-button type="primary" @click="confirmExportPdf" :disabled="pdfLoading || !pdfFrontData || !pdfBackData">{{ tr('merge.step4.export') }}</el-button>
      </template>
    </el-dialog>

    
    <el-dialog v-model="exportDialogVisible" append-to-body width="560px" :close-on-click-modal="false" class="export-dialog">
      <template #header>{{ tr('merge.step4.exportDialogTitle') }}</template>
      <div class="export-options">
        <div class="exp-item">
          <div class="item-header">
            <el-checkbox :model-value="true" disabled>{{ tr('merge.step4.pdfRequired') }}</el-checkbox>
          </div>
          <div class="item-desc">
            {{ tr('merge.step4.pdfDesc') }}
          </div>
        </div>
        <div class="exp-item">
          <div class="item-header">
            <el-checkbox v-model="exportGridEnabled">{{ tr('merge.step4.exportGridPng') }}</el-checkbox>
          </div>
          <div class="item-config" v-if="exportGridEnabled">
            <div class="config-row">
              <span class="label">{{ tr('merge.step4.labelDpi') }}</span>
              <el-input-number
                v-model="exportDpi"
                :min="72"
                :max="1200"
                :step="1"
                size="small"
              />
              <span class="unit">DPI</span>
            </div>
            <div class="config-row">
              <span class="label">{{ tr('merge.step4.labelSize') }}</span>
              <el-input-number v-model="gridExportWidthCm" :min="0.1" :step="0.1" size="small" />
              <span class="sep">×</span>
              <el-input-number v-model="gridExportHeightCm" :min="0.1" :step="0.1" size="small" />
              <span class="unit">cm</span>
            </div>
            <div class="config-row">
              <span class="label">{{ tr('merge.step4.labelPx') }}</span>
              <span class="value">{{ gridExportWidth }} × {{ gridExportHeight }} px</span>
            </div>
            <div class="config-row">
              <el-checkbox v-model="gridExportStroke" class="stroke-check">{{ tr('merge.step4.strokeCheck') }}</el-checkbox>
              <el-color-picker v-model="gridExportStrokeColor" size="small" :disabled="!gridExportStroke" />
              <el-input-number v-model="gridExportStrokeSize" :min="1" :max="200" size="small" :disabled="!gridExportStroke" />
              <span class="unit" v-if="gridExportStroke">px</span>
            </div>
          </div>
        </div>
        <div v-if="mergedImage" class="exp-item">
          <div class="item-header">
            <el-checkbox :model-value="true" disabled>{{ tr('merge.step4.exportMergedPng') }}</el-checkbox>
          </div>
          <div class="item-desc">
            {{ tr('merge.step4.exportMergedPngDesc') }}
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="warning" plain @click="resetStep4ExportMemory" :disabled="exportingAll">{{ tr('merge.step4.reset') }}</el-button>
        <el-button @click="exportDialogVisible=false" :disabled="exportingAll">{{ tr('merge.step4.cancel') }}</el-button>
        <el-button type="primary" @click="confirmExportAll" :loading="exportingAll">{{ tr('merge.step4.export') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useMergeStore } from '../../composables/useMergeStore.js'

const { t: tr } = useI18n()
import { listCovers, getBlob, getCoverImages } from '../../database/indexeddb/coverStore.js'
import { DB_VERSION, DB_NAME } from '../../database/indexeddb/schema.js'
import { ImageObject, TextObject, StrokeLayer } from './core/objects.js'
import { GridGenerator } from '../../core/grid/GridGenerator.js'
import { GridObject } from '../../core/grid/GridObject.js'
import { TableGenerator } from '../../core/table/TableGenerator.js'
import { TableObject } from '../../core/table/TableObject.js'
import { TEXT_DEFAULT_FONT_SIZE, FRONT_TEXT_DEFAULT, BACK_TEXT_DEFAULT, MERGE_MIN_SCALE, MERGE_MAX_SCALE } from '../../constants/mergeDefaults.js'
import { computeCenteredTextLayout, computeRectTextLayout, ensureCoverTextFontReady, getTextMeasureContext, measureTextBox, resolveTextFontFamily } from '../../core/textLayout.js'
import { createPersistScheduler } from './modules/persistScheduler.js'
import { createRendererController } from './modules/rendererController.js'
import { createTextTool } from './modules/textTool.js'
import { createStrokeTool } from './modules/strokeTool.js'
import { createGridTool } from './modules/gridTool.js'
import { createTableTool } from './modules/tableTool.js'
import { createMergeLayerTool } from './modules/mergeLayerTool.js'
import { createInteractionController } from './modules/interactionController.js'
import { createExportTool } from './modules/exportTool.js'
import bus, { EVENTS } from './modules/eventBus.js'
import { activateMerge as selActivateMerge, activateGrid as selActivateGrid, activateTable as selActivateTable, activateStrokes as selActivateStrokes, activateText as selActivateText, clearSelection, getSelection } from './modules/selectionState.js'
import { BRUSH_DEFAULT_COLOR, BRUSH_DEFAULT_SIZE, MERGE_DEBUG } from '../../constants/mergeDefaults.js'

/* ===== Store ===== */
const mergeStore = useMergeStore()
const { mergedImage, effectImage, coverFrontDesign, updateCoverFrontDesign, loadCoverFrontDesign, goStep, cellsData, selectedProject, setCellsData, projectImage } = mergeStore

/* ===== Cover List & Dialog ===== */
const covers = ref([])
const loadingCovers = ref(false)
const coverDialogVisible = ref(false)
const coverCandidateId = ref(null)
const selectedCoverId = ref(coverFrontDesign.coverId || null)
const currentCoverUpdatedAt = ref(coverFrontDesign.coverUpdatedAt || null)
const searchQuery = ref('')
const propTab = ref('obj')
const filteredCovers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if(!q) return covers.value
  return covers.value.filter(c => (c.name||'').toLowerCase().includes(q) || String(c.id).includes(q))
})

function openCoverDialog(){ coverCandidateId.value = selectedCoverId.value; coverDialogVisible.value = true; refreshCovers() }
function selectCoverRow(c){ if(!c) return; coverCandidateId.value = c.id }
function confirmSelectCover(){
  if(!coverCandidateId.value) return
  const nextCoverId = coverCandidateId.value
  persistCtrl?.flush?.()
  persistCtrl?.reset?.()
  selectedCoverId.value = nextCoverId
  coverDialogVisible.value = false
  loadCoverFrontDesign(nextCoverId)
  currentCoverUpdatedAt.value = coverFrontDesign.coverUpdatedAt || null
  persistCtrl?.reset?.(coverFrontDesign)
  nextTick(() => { loadCover() })
}

let objectUrls = []
function releaseCoverThumbUrls(){
  objectUrls.forEach(url => URL.revokeObjectURL(url))
  objectUrls = []
}
async function refreshCovers(){
  loadingCovers.value=true
  try{
    releaseCoverThumbUrls()
    const list = await listCovers(); covers.value = list
    for(const c of covers.value){
      if(c.front_blob_id && !c.frontThumb){ try{ const r = await getBlob(c.front_blob_id); if(r?.blob){ const url = URL.createObjectURL(r.blob); objectUrls.push(url); c.frontThumb = url } }catch(e){ console.warn('frontThumb fail', c.id, e) } }
      if(c.back_blob_id && !c.backThumb){ try{ const r2 = await getBlob(c.back_blob_id); if(r2?.blob){ const url2 = URL.createObjectURL(r2.blob); objectUrls.push(url2); c.backThumb = url2 } }catch(e){ console.warn('backThumb fail', c.id, e) } }
    }
  }catch(e){ console.error(e); ElMessage.error(tr('merge.step4.loadCoversFail')) } finally { loadingCovers.value=false }
}

/* ===== Preview Dialog ===== */
const previewVisible = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
function openPreview(c, side){ if(!c) return; const url = side==='back'? c.backThumb: c.frontThumb; if(!url) return; previewTitle.value = tr('merge.step4.previewHeader', { name: c.name || tr('merge.step4.unnamed'), side: side==='back'? tr('merge.step4.btnBack'): tr('merge.step4.btnFront') }); previewImage.value=url; previewVisible.value=true }

/* ===== Canvas & Rendering ===== */
const canvasRef = ref(null)
const wrapperRef = ref(null)
const zoneRef = ref(null)
const ctx = ref(null)
let renderer = null

// ===== Viewport adaptive scaling (preview-only) =====
const viewScale = ref(1)
const viewScaleMode = ref('auto')
const VIEW_SCALE_MIN = 0.1
const VIEW_SCALE_MAX = 2.5
const viewScalePercent = computed(() => Math.round((Number(viewScale.value || 1)) * 100))

function isViewScaleNear(target, epsilon = 0.03) {
  return viewScaleMode.value === 'manual' && Math.abs(Number(viewScale.value || 0) - Number(target || 0)) <= epsilon
}

function getCanvasViewportMetrics() {
  const zone = zoneRef.value
  const canvas = canvasRef.value
  if (!zone || !canvas) return null
  const zoneRect = zone.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  const canvasLeft = zone.scrollLeft + canvasRect.left - zoneRect.left
  const canvasTop = zone.scrollTop + canvasRect.top - zoneRect.top
  return { zone, canvas, canvasLeft, canvasTop }
}

function clampAnchorPoint(x, y) {
  const img = coverImg.value
  if (!img?.width || !img?.height) return { x: 0, y: 0 }
  return {
    x: Math.max(0, Math.min(Number(img.width), Number(x) || 0)),
    y: Math.max(0, Math.min(Number(img.height), Number(y) || 0))
  }
}

function getSelectionAnchorPoint() {
  if (activeSide.value === 'front' && activeMerge.value && mergedBitmap.value) {
    return clampAnchorPoint(
      mergeLayer.x + (mergeLayer.w || 0) * (mergeLayer.scale || 1) / 2,
      mergeLayer.y + (mergeLayer.h || 0) * (mergeLayer.scale || 1) / 2
    )
  }
  if (activeSide.value === 'back' && activeGrid.value && gridObj.value) {
    return clampAnchorPoint(
      gridLayer.x + (gridLayer.w || 0) * (gridLayer.scale || 1) / 2,
      gridLayer.y + (gridLayer.h || 0) * (gridLayer.scale || 1) / 2
    )
  }
  if (activeSide.value === 'back' && activeTable.value && tableObj.value) {
    return clampAnchorPoint(
      tableLayer.x + (tableLayer.w || 0) * (tableLayer.scale || 1) / 2,
      tableLayer.y + (tableLayer.h || 0) * (tableLayer.scale || 1) / 2
    )
  }
  const activeTextObj = currentActiveText.value
  if (activeTextObj) {
    const selectionRect = activeTextObj.getSelectionRect?.(canvasRef.value?.getContext?.('2d'))
    if (selectionRect) {
      return clampAnchorPoint(selectionRect.x + selectionRect.w / 2, selectionRect.y + selectionRect.h / 2)
    }
    const pos = getTextBoxPosition(activeTextObj)
    return clampAnchorPoint(pos.x + (activeTextObj.w || 0) / 2, pos.y + (activeTextObj.h || 0) / 2)
  }
  return null
}

function getViewportCenterAnchor() {
  const metrics = getCanvasViewportMetrics()
  if (!metrics) return null
  const scale = Math.max(0.0001, Number(viewScale.value || 1))
  const centerX = metrics.zone.scrollLeft + metrics.zone.clientWidth / 2 - metrics.canvasLeft
  const centerY = metrics.zone.scrollTop + metrics.zone.clientHeight / 2 - metrics.canvasTop
  return clampAnchorPoint(centerX / scale, centerY / scale)
}

function captureZoomAnchor() {
  return getSelectionAnchorPoint() || getViewportCenterAnchor()
}

function restoreZoomAnchor(anchor) {
  const metrics = getCanvasViewportMetrics()
  if (!metrics || !anchor) return
  const scale = Math.max(0.0001, Number(viewScale.value || 1))
  const nextLeft = metrics.canvasLeft + anchor.x * scale - metrics.zone.clientWidth / 2
  const nextTop = metrics.canvasTop + anchor.y * scale - metrics.zone.clientHeight / 2
  metrics.zone.scrollTo({
    left: Math.max(0, nextLeft),
    top: Math.max(0, nextTop),
    behavior: 'auto'
  })
}

async function applyManualViewScale(scale) {
  const anchor = captureZoomAnchor()
  viewScaleMode.value = 'manual'
  viewScale.value = clampViewScale(scale)
  await nextTick()
  restoreZoomAnchor(anchor)
}

function clampViewScale(value) {
  const v = Number(value)
  if (!isFinite(v)) return 1
  return Math.max(VIEW_SCALE_MIN, Math.min(VIEW_SCALE_MAX, v))
}

function readPx(value) {
  const n = parseFloat(value || '0')
  return Number.isFinite(n) ? n : 0
}

function getBoxChrome(el) {
  if (!el) return { horizontal: 0, vertical: 0 }
  const styles = window.getComputedStyle(el)
  return {
    horizontal:
      readPx(styles.paddingLeft) +
      readPx(styles.paddingRight) +
      readPx(styles.borderLeftWidth) +
      readPx(styles.borderRightWidth),
    vertical:
      readPx(styles.paddingTop) +
      readPx(styles.paddingBottom) +
      readPx(styles.borderTopWidth) +
      readPx(styles.borderBottomWidth)
  }
}

function getFittedViewScale() {
  const zone = zoneRef.value
  const img = coverImg.value
  if (!zone || !img || !img.width || !img.height) return 1

  const zoneChrome = getBoxChrome(zone)
  const wrapperChrome = getBoxChrome(wrapperRef.value)

  const availW = Math.max(60, zone.clientWidth - zoneChrome.horizontal - wrapperChrome.horizontal)
  const availH = Math.max(60, zone.clientHeight - zoneChrome.vertical - wrapperChrome.vertical)
  const fittedScale = Math.min(availW / img.width, availH / img.height)

  return clampViewScale(Math.max(0.08, Math.min(1, fittedScale)))
}

const canvasViewStyle = computed(() => {
  const img = coverImg.value
  const s = Number(viewScale.value || 1)
  if (!img || !img.width || !img.height || !isFinite(s) || s <= 0) return {}
  // Use CSS size scaling (not transform) so pointer mapping via getBoundingClientRect stays correct.
  return {
    width: `${Math.max(1, Math.round(img.width * s))}px`,
    height: `${Math.max(1, Math.round(img.height * s))}px`,
    maxWidth: 'unset'
  }
})

function updateViewScale(reason = 'auto', force = false) {
  try {
    const fittedScale = getFittedViewScale()
    if (force || viewScaleMode.value === 'auto') {
      viewScale.value = fittedScale
    } else {
      viewScale.value = clampViewScale(viewScale.value)
    }
    if (MERGE_DEBUG) {
      const img = coverImg.value
      console.log('[cover-compose] updateViewScale', reason, {
        img: img ? `${img.width}x${img.height}` : 'none',
        mode: viewScaleMode.value,
        fittedScale,
        viewScale: viewScale.value
      })
    }
  } catch (_) { viewScale.value = 1 }
}

function setManualViewScale(scale) {
  applyManualViewScale(scale)
}

function nudgeViewScale(delta) {
  applyManualViewScale((Number(viewScale.value || 1)) + delta)
}

function useFitViewScale() {
  viewScaleMode.value = 'auto'
  updateViewScale('fit-view', true)
}

function scrollLayerIntoView(layer, behavior = 'smooth') {
  const zone = zoneRef.value
  const canvas = canvasRef.value
  if (!zone || !canvas || !layer) return

  const zoneRect = zone.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  const canvasLeft = zone.scrollLeft + canvasRect.left - zoneRect.left
  const canvasTop = zone.scrollTop + canvasRect.top - zoneRect.top
  const scale = Number(viewScale.value || 1)
  const layerScale = Number(layer.scale || 1)
  const layerWidth = Math.max(1, (layer.w || 0) * layerScale * scale)
  const layerHeight = Math.max(1, (layer.h || 0) * layerScale * scale)
  const left = Math.max(0, canvasLeft + (layer.x || 0) * scale + layerWidth / 2 - zone.clientWidth / 2)
  const top = Math.max(0, canvasTop + (layer.y || 0) * scale + layerHeight / 2 - zone.clientHeight / 2)

  zone.scrollTo({ left, top, behavior })
}

async function focusTableView() {
  if (!tableObj.value || !tableLayer.w || !tableLayer.h) return

  viewScaleMode.value = 'auto'
  updateViewScale('focus-table', true)
  await nextTick()
  requestAnimationFrame(() => scrollLayerIntoView(tableLayer))
}

const coverImg = ref(null)
const coverImgLoaded = ref(false)
const mergedBitmap = ref(null) // actual Image instance for mergedImage base64
// NEW: store both sides to avoid reload mixups
const coverImgFront = ref(null)
const coverImgBack = ref(null)
const DEFAULT_COVER_EXPORT_DPI = 300
const coverSourceMetaFront = ref(createEmptyCoverSourceMeta())
const coverSourceMetaBack = ref(createEmptyCoverSourceMeta())
const effectPlacementRect = reactive({ x:0,y:0,w:0,h:0,rotation:0,has:false })
const hasEffectPlacement = computed(() => !!(effectPlacementRect.has && effectPlacementRect.w > 0 && effectPlacementRect.h > 0))
/* ===== Front Merge Layer State ===== */
const mergeLayer = reactive({ x:0, y:0, w:0, h:0, scale:1, rotate:0 })
const imageObj = ref(null)
// 
function ensureImageObject(){
  if(!mergedBitmap.value) return;
  const img = mergedBitmap.value;
  if(imageObj.value && imageObj.value._src === img) return;
  try { imageObj.value = new ImageObject(img); } catch(e){ imageObj.value = { image: img }; }
  imageObj.value._src = img;
}

/* ===== Stroke Layer (shared renderer object, data per side) ===== */
const strokeLayerObj = new StrokeLayer()

/* ===== Side Switch & Back Grid/Text State ===== */
const activeSide = ref('front') // 'front' | 'back'
// Back grid (placement-aware)
const gridLayer = reactive({ x:0,y:0,w:0,h:0,scale:1,rotate:0 }) // w/h = base bitmap size (unscaled)
const gridPlacementRect = reactive({ x:0,y:0,w:0,h:0,rotation:0,has:false }) // 
const gridObj = ref(null)
const gridGenerator = ref(null)
const activeGrid = ref(false)
// Back table (placement-aware; allows non-uniform scaling later)
const tableLayer = reactive({ x:0,y:0,w:0,h:0,scale:1,rotate:0,columns:1,maxRowsPerTable:15 }) // w/h base
const tablePlacementRect = reactive({ x:0,y:0,w:0,h:0,rotation:0,has:false })
const tableObj = ref(null)
const tableGenerator = ref(null)
const activeTable = ref(false)
const backPlacementIssue = reactive({ missingGrid:false, missingTable:false })
const backPlacementMissingLabels = computed(() => {
  const list = []
  if(backPlacementIssue.missingGrid) list.push(tr('merge.step4.layerGrid'))
  if(backPlacementIssue.missingTable) list.push(tr('merge.step4.layerTable'))
  return list.join(' / ')
})
const hasBackPlacementIssue = computed(() => !!coverImgBack.value && (backPlacementIssue.missingGrid || backPlacementIssue.missingTable))
// Back texts
const backTexts = ref([])
const backActiveTextId = ref(null)
const backActiveText = ref(null)
// Back strokes
const backStrokes = ref([])

/* ===== Front Texts ===== */
const texts = ref([])
const activeTextId = ref(null)
const activeText = ref(null)
const textInputRef = ref(null)

/* ===== Strokes (front) ===== */
const strokes = ref([]) // each {color,size,points:[]}
// Brush state (was missing, causing ReferenceError)
const brushMode = ref(false)
const brushColor = ref(BRUSH_DEFAULT_COLOR)
const brushSize = ref(BRUSH_DEFAULT_SIZE)

/* ===== Computed unified collections ===== */
const currentTexts = computed(()=> activeSide.value==='front' ? texts.value : backTexts.value)
const currentActiveText = computed(()=> activeSide.value==='front' ? activeText.value : backActiveText.value)
const currentStrokes = computed(()=> activeSide.value==='front' ? strokes.value : backStrokes.value)
const currentCoverName = computed(()=>{ const c = covers.value.find(c=>c.id===selectedCoverId.value); return c?.name || ''; })
const currentProjectName = computed(() => {
  const candidates = [
    selectedProject.value?.name,
    selectedProject.value?.project_name,
    selectedProject.value?.result?.projectName,
    selectedProject.value?.result?.project_name
  ]
  const raw = candidates.find(value => typeof value === 'string' && value.trim())
  return raw ? raw.trim() : ''
})

function isDefaultCoverTextValue(value){
  const text = typeof value === 'string' ? value.trim() : ''
  if(!text) return true
  const placeholders = new Set([
    '示例文字',
    'Sample text',
    '新文字',
    'New text',
    FRONT_TEXT_DEFAULT,
    BACK_TEXT_DEFAULT,
    tr('placement.sampleText'),
    tr('merge.step4.newTextDefault')
  ])
  return placeholders.has(text)
}

function resolveDefaultCoverText(rawText, isFront){
  const text = typeof rawText === 'string' ? rawText.trim() : ''
  if(text && !isDefaultCoverTextValue(text)) return text
  const fallback = isFront ? FRONT_TEXT_DEFAULT : BACK_TEXT_DEFAULT
  return currentProjectName.value || text || fallback || tr('merge.step4.newTextDefault')
}

// Controller / tool placeholders (must appear before functions that reference them)
let rendererCtrl = null
let persistCtrl = null
let textTool = null
let strokeTool = null
let gridTool = null
let tableTool = null
let mergeTool = null
let interaction = null
let exportTool = null

// Reactive flags (simple declarations; remove self-referencing pattern that caused init errors)
const activeMerge = ref(false)
const activeStrokeLayer = ref(false)
const draggingMerge = ref(false)

// Helpers supplied to textTool
function setActiveFrontText(id){ setActiveText(id) }
function setActiveBackTextWrapper(id){ setActiveBackText(id) }

function getActiveSideTextContext(){
  return activeSide.value === 'front'
    ? { list: texts.value, activeId: activeTextId.value, setActive: setActiveText }
    : { list: backTexts.value, activeId: backActiveTextId.value, setActive: setActiveBackText }
}

function focusActiveTextInput(){
  propTab.value = 'obj'
  nextTick(() => {
    requestAnimationFrame(() => {
      const input = textInputRef.value
      if(!input) return
      try {
        if(typeof input.focus === 'function') input.focus()
        else input?.input?.focus?.()
      } catch(_) {}
    })
  })
}

function autoSelectTextForActiveSide({ focus = false } = {}){
  const { list, activeId, setActive } = getActiveSideTextContext()
  if(!Array.isArray(list) || list.length === 0) return false
  const targetId = list.some(t => t?.id === activeId) ? activeId : list[0]?.id
  if(!targetId) return false
  if(getSelection()?.type !== 'text' || targetId !== activeId){
    setActive(targetId)
  }
  if(focus) focusActiveTextInput()
  return true
}

function redraw(reason='manual'){ if(rendererCtrl) rendererCtrl.requestRedraw(reason) }
function getTextMeasureCtx(){
  return getTextMeasureContext(canvasRef.value ? canvasRef.value.getContext('2d') : null)
}
function measureTextMetrics(t){
  const metrics = measureTextBox(getTextMeasureCtx(), t?.text, { weight: t?.weight, fontSize: t?.fontSize || 16, fontFamily: t?.fontFamily })
  return { width: metrics.width, ascent: metrics.ascent, descent: metrics.descent, height: metrics.height }
}
function resolveTextAlignValue(value){
  const align = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['left', 'center', 'right'].includes(align) ? align : 'left'
}
function normalizeRotationValue(value){
  const angle = Number(value)
  if(!Number.isFinite(angle)) return 0
  return ((angle % 360) + 360) % 360
}
function getRotatedBoundsSize(width, height, rotation = 0){
  const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1)
  const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1)
  const angle = normalizeRotationValue(rotation)
  if(!angle) return { width: safeWidth, height: safeHeight }
  const radians = angle * Math.PI / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  return {
    width: safeWidth * cos + safeHeight * sin,
    height: safeWidth * sin + safeHeight * cos
  }
}
function clampLayerRectToCover(x, y, width, height, rotation = 0){
  if(!coverImg.value){
    return { x, y }
  }
  const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1)
  const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1)
  const coverWidth = Math.max(1, Number.isFinite(+coverImg.value?.width) ? +coverImg.value.width : 1)
  const coverHeight = Math.max(1, Number.isFinite(+coverImg.value?.height) ? +coverImg.value.height : 1)
  const rotated = getRotatedBoundsSize(safeWidth, safeHeight, rotation)
  if(rotated.width > coverWidth || rotated.height > coverHeight){
    return {
      x: safeWidth >= coverWidth ? 0 : Math.max(0, Math.min(x, coverWidth - safeWidth)),
      y: safeHeight >= coverHeight ? 0 : Math.max(0, Math.min(y, coverHeight - safeHeight))
    }
  }
  const centerX = x + safeWidth / 2
  const centerY = y + safeHeight / 2
  return {
    x: Math.max(rotated.width / 2, Math.min(centerX, coverWidth - rotated.width / 2)) - safeWidth / 2,
    y: Math.max(rotated.height / 2, Math.min(centerY, coverHeight - rotated.height / 2)) - safeHeight / 2
  }
}
function applyLayerRotation(layer, width, height, rawRotation){
  if(!layer) return
  layer.rotate = normalizeRotationValue(rawRotation)
  const clamped = clampLayerRectToCover(layer.x, layer.y, width, height, layer.rotate)
  layer.x = clamped.x
  layer.y = clamped.y
}
function applyLayerScale(layer, width, height){
  if(!layer) return
  const clamped = clampLayerRectToCover(layer.x, layer.y, width, height, layer.rotate)
  layer.x = clamped.x
  layer.y = clamped.y
}
function measureTextWidth(t){ return measureTextMetrics(t).width }
function resetCurrentCoverDesignSnapshot(coverUpdatedAt = null){
  updateCoverFrontDesign({
    coverId: selectedCoverId.value,
    coverUpdatedAt,
    hasSnapshot: false,
    merge: { x: 0, y: 0, scale: 1, w: 0, h: 0, rotate: 0 },
    grid: { x: 0, y: 0, w: 0, h: 0, scale: 1, rotate: 0 },
    table: { x: 0, y: 0, w: 0, h: 0, scale: 1, rotate: 0, columns: 1, maxRowsPerTable: 15 },
    texts: [],
    backTexts: [],
    strokes: [],
    backStrokes: []
  })
  persistCtrl?.reset?.(coverFrontDesign)
}
function syncCurrentCoverDesignSnapshot(coverMeta = null){
  const coverId = selectedCoverId.value
  const coverUpdatedAt = typeof coverMeta?.updated_at === 'string' && coverMeta.updated_at
    ? coverMeta.updated_at
    : null
  currentCoverUpdatedAt.value = coverUpdatedAt
  if(coverId == null) return false
  const sameCover = coverFrontDesign.coverId != null && coverFrontDesign.coverId === coverId
  const sameRevision = coverFrontDesign.coverUpdatedAt === coverUpdatedAt
  if(!sameCover || !sameRevision){
    resetCurrentCoverDesignSnapshot(coverUpdatedAt)
    return false
  }
  return coverFrontDesign.hasSnapshot === true
}
function hasStoredFrontDesignForCurrentCover(){
  return (
    coverFrontDesign.hasSnapshot === true &&
    coverFrontDesign.coverId != null &&
    coverFrontDesign.coverId === selectedCoverId.value &&
    coverFrontDesign.coverUpdatedAt === currentCoverUpdatedAt.value
  )
}
function cloneStrokeList(list){
  return Array.isArray(list)
    ? list.map(stroke => ({
        ...stroke,
        points: Array.isArray(stroke?.points) ? stroke.points.map(point => ({ ...point })) : []
      }))
    : []
}
function applyPlacementTextLayout(t){
  if(!t) return
  const width = Number.isFinite(+t.placementW) ? +t.placementW : 0
  const height = Number.isFinite(+t.placementH) ? +t.placementH : 0
  if(width <= 0 || height <= 0) return false
  t.align = resolveTextAlignValue(t.align)
  t.rotate = normalizeRotationValue(t.rotate)
  const layout = computeRectTextLayout(
    { x: Number.isFinite(+t.placementX) ? +t.placementX : t.x || 0, y: Number.isFinite(+t.placementY) ? +t.placementY : t.y || 0, width, height },
    t.text,
    { fontSize: t.fontSize, fontFamily: t.fontFamily, weight: t.weight, align: t.align },
    getTextMeasureCtx()
  )
  t.x = layout.left
  t.y = layout.baselineY
  t.w = layout.width
  t.h = layout.height
  t.ascent = layout.ascent
  t.descent = layout.descent
  t.boxX = layout.left
  t.boxY = layout.top
  return true
}
function pinManualTextPosition(t){
  if(!t) return
  const hasBoxX = Number.isFinite(+t.boxX)
  const hasBoxY = Number.isFinite(+t.boxY)
  if(!hasBoxX || !hasBoxY){
    t.boxX = Number.isFinite(+t.x) ? +t.x : 0
    t.boxY = (Number.isFinite(+t.y) ? +t.y : 0) - (Number.isFinite(+t.ascent) ? +t.ascent : 0)
  }
  t.x = Number.isFinite(+t.boxX) ? +t.boxX : 0
  t.y = (Number.isFinite(+t.boxY) ? +t.boxY : 0) + (Number.isFinite(+t.ascent) ? +t.ascent : 0)
}
function getTextBoxPosition(t){
  if(!t) return { x: 0, y: 0 }
  const ascent = Number.isFinite(+t.ascent) ? +t.ascent : 0
  const x = Number.isFinite(+t.boxX) ? +t.boxX : (Number.isFinite(+t.x) ? +t.x : 0)
  const y = Number.isFinite(+t.boxY) ? +t.boxY : ((Number.isFinite(+t.y) ? +t.y : 0) - ascent)
  return { x, y }
}
function getPlacementTextPosition(t){
  if(!t) return { x: 0, y: 0 }
  const hasPlacementX = Number.isFinite(+t.placementX)
  const hasPlacementY = Number.isFinite(+t.placementY)
  if(t.manualPosition !== true && hasPlacementX && hasPlacementY){
    return { x: +t.placementX, y: +t.placementY }
  }
  return getTextBoxPosition(t)
}
function formatTextPosition(t){
  const pos = getPlacementTextPosition(t)
  return `${Math.round(pos.x)}, ${Math.round(pos.y)}`
}
function clampTextBoxToCover(t, x, y){
  if(!coverImg.value) return { x, y }
  const textWidth = Math.max(1, Number.isFinite(+t?.w) ? +t.w : 1)
  const textHeight = Math.max(1, Number.isFinite(+t?.h) ? +t.h : Math.max(1, Number.isFinite(+t?.fontSize) ? +t.fontSize : 1))
  const coverWidth = Math.max(1, Number.isFinite(+coverImg.value?.width) ? +coverImg.value.width : 1)
  const coverHeight = Math.max(1, Number.isFinite(+coverImg.value?.height) ? +coverImg.value.height : 1)
  const rotated = getRotatedBoundsSize(textWidth, textHeight, t?.rotate)
  if(rotated.width > coverWidth || rotated.height > coverHeight){
    return {
      x: textWidth >= coverWidth ? 0 : Math.max(0, Math.min(x, coverWidth - textWidth)),
      y: textHeight >= coverHeight ? 0 : Math.max(0, Math.min(y, coverHeight - textHeight))
    }
  }
  const centerX = x + textWidth / 2
  const centerY = y + textHeight / 2
  const nextCenterX = Math.max(rotated.width / 2, Math.min(centerX, coverWidth - rotated.width / 2))
  const nextCenterY = Math.max(rotated.height / 2, Math.min(centerY, coverHeight - rotated.height / 2))
  return { x: nextCenterX - textWidth / 2, y: nextCenterY - textHeight / 2 }
}
function clampPlacementRectToCover(t, x, y){
  if(!coverImg.value) return { x, y }
  const placementWidth = Math.max(1, Number.isFinite(+t?.placementW) ? +t.placementW : Math.max(1, Number.isFinite(+t?.w) ? +t.w : 1))
  const placementHeight = Math.max(1, Number.isFinite(+t?.placementH) ? +t.placementH : Math.max(1, Number.isFinite(+t?.h) ? +t.h : Math.max(1, Number.isFinite(+t?.fontSize) ? +t.fontSize : 1)))
  const coverWidth = Math.max(1, Number.isFinite(+coverImg.value?.width) ? +coverImg.value.width : 1)
  const coverHeight = Math.max(1, Number.isFinite(+coverImg.value?.height) ? +coverImg.value.height : 1)
  const rotated = getRotatedBoundsSize(placementWidth, placementHeight, t?.rotate)
  if(rotated.width > coverWidth || rotated.height > coverHeight){
    return {
      x: placementWidth >= coverWidth ? 0 : Math.max(0, Math.min(x, coverWidth - placementWidth)),
      y: placementHeight >= coverHeight ? 0 : Math.max(0, Math.min(y, coverHeight - placementHeight))
    }
  }
  const centerX = x + placementWidth / 2
  const centerY = y + placementHeight / 2
  const nextCenterX = Math.max(rotated.width / 2, Math.min(centerX, coverWidth - rotated.width / 2))
  const nextCenterY = Math.max(rotated.height / 2, Math.min(centerY, coverHeight - rotated.height / 2))
  return { x: nextCenterX - placementWidth / 2, y: nextCenterY - placementHeight / 2 }
}
function updateCurrentTextCoordinate(axis, rawValue){
  const t = currentActiveText.value
  if(!t) return
  const value = Number(rawValue)
  if(!Number.isFinite(value)) return
  recomputeTextMetrics(t)
  const currentPos = getPlacementTextPosition(t)
  const targetX = axis === 'x' ? value : currentPos.x
  const targetY = axis === 'y' ? value : currentPos.y
  const hasPlacementX = Number.isFinite(+t.placementX)
  const hasPlacementY = Number.isFinite(+t.placementY)
  if(t.manualPosition !== true && hasPlacementX && hasPlacementY){
    const clamped = clampPlacementRectToCover(t, targetX, targetY)
    t.placementX = clamped.x
    t.placementY = clamped.y
    t.manualPosition = false
  } else {
    const clamped = clampTextBoxToCover(t, targetX, targetY)
    t.boxX = clamped.x
    t.boxY = clamped.y
    t.manualPosition = true
  }
  handleTextMutated(t, `text-position-${axis}`)
  schedulePersist('text')
}
const currentTextCoordX = computed({
  get(){
    return Math.round(getPlacementTextPosition(currentActiveText.value).x)
  },
  set(value){
    updateCurrentTextCoordinate('x', value)
  }
})
const currentTextCoordY = computed({
  get(){
    return Math.round(getPlacementTextPosition(currentActiveText.value).y)
  },
  set(value){
    updateCurrentTextCoordinate('y', value)
  }
})
function buildTextPlacementLookup(placements = []){
  const lookup = new Map()
  ;(placements || []).forEach(p => {
    if(!p) return
    const id = p.id == null ? '' : String(p.id)
    if(id) lookup.set(id, p)
  })
  return lookup
}
function resolveStoredTextPlacement(raw, placementLookup){
  const meta = {
    placementId: raw?.placementId ?? raw?.sourcePlacementId ?? null,
    placementX: Number.isFinite(+raw?.placementX) ? +raw.placementX : null,
    placementY: Number.isFinite(+raw?.placementY) ? +raw.placementY : null,
    placementW: Number.isFinite(+raw?.placementW) ? +raw.placementW : null,
    placementH: Number.isFinite(+raw?.placementH) ? +raw.placementH : null,
    placementRotation: Number.isFinite(+raw?.placementRotation) ? normalizeRotationValue(raw.placementRotation) : null
  }
  const hasFullPlacement = [meta.placementX, meta.placementY, meta.placementW, meta.placementH].every(v => Number.isFinite(v))
  const hasPlacementRotation = Number.isFinite(meta.placementRotation)
  if(hasFullPlacement && hasPlacementRotation) return meta
  const candidateKeys = []
  if(meta.placementId != null && meta.placementId !== '') candidateKeys.push(String(meta.placementId))
  if(raw?.sourcePlacementId != null && raw.sourcePlacementId !== '') candidateKeys.push(String(raw.sourcePlacementId))
  if(typeof raw?.id === 'string' && raw.id.startsWith('cover-text-')) candidateKeys.push(raw.id.slice('cover-text-'.length))
  for(const key of candidateKeys){
    const placement = placementLookup?.get?.(key)
    if(!placement) continue
    return {
      placementId: key,
      placementX: hasFullPlacement ? meta.placementX : (Number.isFinite(+placement.x) ? +placement.x : null),
      placementY: hasFullPlacement ? meta.placementY : (Number.isFinite(+placement.y) ? +placement.y : null),
      placementW: hasFullPlacement ? meta.placementW : (Number.isFinite(+placement.width) ? +placement.width : null),
      placementH: hasFullPlacement ? meta.placementH : (Number.isFinite(+placement.height) ? +placement.height : null),
      placementRotation: Number.isFinite(+placement.rotation) ? normalizeRotationValue(placement.rotation) : 0
    }
  }
  return meta
}
function applyResolvedPlacementMeta(obj, placementMeta){
  if(!obj || !placementMeta) return
  if(placementMeta.placementId != null && placementMeta.placementId !== '') obj.placementId = placementMeta.placementId
  if(Number.isFinite(placementMeta.placementX)) obj.placementX = placementMeta.placementX
  if(Number.isFinite(placementMeta.placementY)) obj.placementY = placementMeta.placementY
  if(Number.isFinite(placementMeta.placementW)) obj.placementW = placementMeta.placementW
  if(Number.isFinite(placementMeta.placementH)) obj.placementH = placementMeta.placementH
  if(Number.isFinite(placementMeta.placementRotation)) obj.placementRotation = placementMeta.placementRotation
}
function hydrateStoredTextObject(raw, placementLookup = null){
  if(!raw) return null
  let obj
  try { obj = new TextObject({ ...raw, fontFamily: resolveTextFontFamily(raw.fontFamily) }); obj.id = raw.id } catch(_) { obj = { ...raw, fontFamily: resolveTextFontFamily(raw.fontFamily) } }
  obj.align = resolveTextAlignValue(raw.align ?? obj.align)
  obj.rotate = Number.isFinite(+raw?.rotate) ? normalizeRotationValue(raw.rotate) : normalizeRotationValue(obj.rotate)
  obj.manualPosition = raw.manualPosition === true
  obj.boxX = Number.isFinite(+raw.boxX) ? +raw.boxX : raw.boxX
  obj.boxY = Number.isFinite(+raw.boxY) ? +raw.boxY : raw.boxY
  applyResolvedPlacementMeta(obj, resolveStoredTextPlacement(raw, placementLookup))
  if(!Number.isFinite(+raw?.rotate) && Number.isFinite(+obj.placementRotation)){
    obj.rotate = normalizeRotationValue(obj.placementRotation)
  }
  recomputeTextMetrics(obj)
  if(obj.manualPosition) pinManualTextPosition(obj)
  else applyPlacementTextLayout(obj)
  return obj
}
function restoreStoredFrontTexts(frontTextPlacements = []){
  if(!hasStoredFrontDesignForCurrentCover()) return false
  const storedTexts = Array.isArray(coverFrontDesign.texts) ? coverFrontDesign.texts : []
  const placementLookup = buildTextPlacementLookup(frontTextPlacements)
  texts.value = storedTexts.map(raw => hydrateStoredTextObject(raw, placementLookup)).filter(Boolean)
  if(MERGE_DEBUG) console.log('[cover-compose] restore stored front texts', { count: texts.value.length, coverId: selectedCoverId.value })
  return true
}
function restoreStoredBackTexts(backTextPlacements = []){
  if(!hasStoredFrontDesignForCurrentCover()) return false
  const storedTexts = Array.isArray(coverFrontDesign.backTexts) ? coverFrontDesign.backTexts : []
  const placementLookup = buildTextPlacementLookup(backTextPlacements)
  backTexts.value = storedTexts.map(raw => hydrateStoredTextObject(raw, placementLookup)).filter(Boolean)
  if(MERGE_DEBUG) console.log('[cover-compose] restore stored back texts', { count: backTexts.value.length, coverId: selectedCoverId.value })
  return true
}
function restoreStoredStrokes(targetRef, storedList, key){
  if(!hasStoredFrontDesignForCurrentCover()) return false
  targetRef.value = cloneStrokeList(storedList)
  if(MERGE_DEBUG) console.log('[cover-compose] restore stored strokes', { key, count: targetRef.value.length, coverId: selectedCoverId.value })
  return true
}
function restoreStoredMergeLayer(){
  if(!hasStoredFrontDesignForCurrentCover()) return false
  const saved = coverFrontDesign.merge || {}
  if(!saved || typeof saved !== 'object') return false
  mergeLayer.x = Number.isFinite(+saved.x) ? +saved.x : mergeLayer.x
  mergeLayer.y = Number.isFinite(+saved.y) ? +saved.y : mergeLayer.y
  mergeLayer.scale = Number.isFinite(+saved.scale) && +saved.scale > 0 ? +saved.scale : mergeLayer.scale
  mergeLayer.rotate = Number.isFinite(+saved.rotate) ? normalizeRotationValue(saved.rotate) : normalizeRotationValue(mergeLayer.rotate || 0)
  if(mergedBitmap.value){
    mergeLayer.w = mergedBitmap.value.width || mergeLayer.w
    mergeLayer.h = mergedBitmap.value.height || mergeLayer.h
  }
  if(MERGE_DEBUG) console.log('[cover-compose] restore stored merge layer', { coverId: selectedCoverId.value, merge: { ...mergeLayer } })
  return true
}

function getStoredGridSnapshot(){
  if(!hasStoredFrontDesignForCurrentCover()) return null
  const saved = coverFrontDesign.grid
  return saved && typeof saved === 'object' ? saved : null
}

function getStoredTableSnapshot(){
  if(!hasStoredFrontDesignForCurrentCover()) return null
  const saved = coverFrontDesign.table
  return saved && typeof saved === 'object' ? saved : null
}

function restoreStoredGridLayer(){
  const saved = getStoredGridSnapshot()
  if(!saved || !gridObj.value) return false
  gridLayer.scale = Number.isFinite(+saved.scale) && +saved.scale > 0 ? +saved.scale : gridLayer.scale
  gridLayer.rotate = Number.isFinite(+saved.rotate) ? normalizeRotationValue(saved.rotate) : normalizeRotationValue(gridLayer.rotate || 0)
  const nextX = Number.isFinite(+saved.x) ? +saved.x : gridLayer.x
  const nextY = Number.isFinite(+saved.y) ? +saved.y : gridLayer.y
  const clamped = clampLayerRectToCover(
    nextX,
    nextY,
    (gridLayer.w || 0) * (gridLayer.scale || 1),
    (gridLayer.h || 0) * (gridLayer.scale || 1),
    gridLayer.rotate
  )
  gridLayer.x = clamped.x
  gridLayer.y = clamped.y
  gridTool?.regenerateGrid?.()
  if(MERGE_DEBUG) console.log('[cover-compose] restore stored grid layer', { coverId: selectedCoverId.value, grid: { ...gridLayer } })
  return true
}

function restoreStoredTableLayer(){
  const saved = getStoredTableSnapshot()
  if(!saved || !tableObj.value) return false
  tableLayer.scale = Number.isFinite(+saved.scale) && +saved.scale > 0 ? +saved.scale : tableLayer.scale
  tableLayer.rotate = Number.isFinite(+saved.rotate) ? normalizeRotationValue(saved.rotate) : normalizeRotationValue(tableLayer.rotate || 0)
  tableLayer.columns = Number.isFinite(+saved.columns) ? Math.max(1, Math.round(+saved.columns)) : tableLayer.columns
  tableLayer.maxRowsPerTable = Number.isFinite(+saved.maxRowsPerTable) ? Math.max(1, Math.round(+saved.maxRowsPerTable)) : tableLayer.maxRowsPerTable
  const nextX = Number.isFinite(+saved.x) ? +saved.x : tableLayer.x
  const nextY = Number.isFinite(+saved.y) ? +saved.y : tableLayer.y
  const clamped = clampLayerRectToCover(
    nextX,
    nextY,
    (tableLayer.w || 0) * (tableLayer.scale || 1),
    (tableLayer.h || 0) * (tableLayer.scale || 1),
    tableLayer.rotate
  )
  tableLayer.x = clamped.x
  tableLayer.y = clamped.y
  if(MERGE_DEBUG) console.log('[cover-compose] restore stored table layer', { coverId: selectedCoverId.value, table: { ...tableLayer } })
  return true
}

function ensureBackDerivedLayers(reason = 'back-derived'){
  if(!ensureBackDerivedLayersReady({ notify:false })) return false
  const storedTable = getStoredTableSnapshot()
  if(storedTable && tableTool?.setTableCount){
    tableTool.setTableCount(storedTable.columns, { rebuild: false })
  }
  gridTool && gridTool.ensureGrid({ placement: gridPlacementRect })
  tableTool && tableTool.ensureTable({ placement: tablePlacementRect })
  const restoredGrid = restoreStoredGridLayer()
  const restoredTable = restoreStoredTableLayer()
  redraw(reason)
  if(MERGE_DEBUG){
    console.log('[cover-compose] ensureBackDerivedLayers', {
      reason,
      restoredGrid,
      restoredTable,
      coverId: selectedCoverId.value
    })
  }
  return true
}

// Wrapper functions still referenced in template after modularization
function regenerateGrid(){
  applyLayerScale(gridLayer, (gridLayer.w || 0) * (gridLayer.scale || 1), (gridLayer.h || 0) * (gridLayer.scale || 1))
  gridTool && gridTool.regenerateGrid && gridTool.regenerateGrid()
  schedulePersist('grid')
}
function regenerateTable(){
  applyLayerScale(tableLayer, (tableLayer.w || 0) * (tableLayer.scale || 1), (tableLayer.h || 0) * (tableLayer.scale || 1))
  redraw('table-scale')
  schedulePersist('table')
}
function resetMergePos(){ mergeTool && mergeTool.reset(true) }
function nudgeScale(f){ mergeTool && mergeTool.nudgeScale(f) }
function resetPlacementRect(rect){
  rect.x = 0
  rect.y = 0
  rect.w = 0
  rect.h = 0
  rect.rotation = 0
  rect.has = false
}
function resetEffectPlacementRect(){
  effectPlacementRect.x = 0
  effectPlacementRect.y = 0
  effectPlacementRect.w = 0
  effectPlacementRect.h = 0
  effectPlacementRect.rotation = 0
  effectPlacementRect.has = false
}
function resetBackPlacementIssue(){
  backPlacementIssue.missingGrid = false
  backPlacementIssue.missingTable = false
}
function resetBackDerivedLayers(){
  gridObj.value = null
  tableObj.value = null
  activeGrid.value = false
  activeTable.value = false
  gridLayer.x = 0
  gridLayer.y = 0
  gridLayer.w = 0
  gridLayer.h = 0
  gridLayer.scale = 1
  gridLayer.rotate = 0
  tableLayer.x = 0
  tableLayer.y = 0
  tableLayer.w = 0
  tableLayer.h = 0
  tableLayer.scale = 1
  tableLayer.rotate = 0
  tableLayer.columns = 1
  tableLayer.maxRowsPerTable = 15
  if(tableTool?.setTableCount) tableTool.setTableCount(1, { rebuild: false })
  if(tableTool?.tableObjs) tableTool.tableObjs.value = []
  const selType = getSelection()?.type
  if(selType === 'grid' || selType === 'table') clearSelection()
}
function ensureBackDerivedLayersReady({ notify=false } = {}){
  if(!coverImgBack.value) return true
  if(!hasBackPlacementIssue.value) return true
  resetBackDerivedLayers()
  if(notify){
    ElMessage.error(tr('merge.step4.backPlacementsMissingToast', { items: backPlacementMissingLabels.value }))
  }
  return false
}
function createHandledError(code, message){
  const err = new Error(message)
  err.code = code
  err.handled = true
  return err
}
//  (1-3) tableTool.setTableCount
const tableCount = computed({
  get(){ return tableTool && tableTool.tableCount ? tableTool.tableCount.value : 1 },
  set(v){
    if(tableTool && tableTool.setTableCount){
      tableTool.setTableCount(v)
      schedulePersist('table')
      redraw('table-count')
    }
  }
})
// === Merge (front) scale / rotate handlers () ===
function onScaleInput(){ schedulePersist('merge'); redraw('merge-scale') }
function onGridRotateInput(){
  applyLayerRotation(gridLayer, gridLayer.w * gridLayer.scale, gridLayer.h * gridLayer.scale, gridLayer.rotate)
  redraw('grid-rotate-input')
}
function onGridRotateChange(){
  applyLayerRotation(gridLayer, gridLayer.w * gridLayer.scale, gridLayer.h * gridLayer.scale, gridLayer.rotate)
  schedulePersist('grid')
  redraw('grid-rotate-change')
}
function onTableRotateInput(){
  applyLayerRotation(tableLayer, tableLayer.w * tableLayer.scale, tableLayer.h * tableLayer.scale, tableLayer.rotate)
  redraw('table-rotate-input')
}
function onTableRotateChange(){
  applyLayerRotation(tableLayer, tableLayer.w * tableLayer.scale, tableLayer.h * tableLayer.scale, tableLayer.rotate)
  schedulePersist('table')
  redraw('table-rotate-change')
}
function onRotateInput(){
  applyLayerRotation(mergeLayer, (mergeLayer.w || 0) * (mergeLayer.scale || 1), (mergeLayer.h || 0) * (mergeLayer.scale || 1), mergeLayer.rotate)
  redraw('merge-rotate-input')
}
function onRotateChange(){
  applyLayerRotation(mergeLayer, (mergeLayer.w || 0) * (mergeLayer.scale || 1), (mergeLayer.h || 0) * (mergeLayer.scale || 1), mergeLayer.rotate)
  schedulePersist('merge')
  redraw('merge-rotate-change')
}

/* ===== Load Cover (front image + merged image) ===== */
let loadingBase = false
async function loadCover(){
  if(loadingBase) return; loadingBase=true
  currentCoverUpdatedAt.value = null
  try {
    if(selectedCoverId.value){
      try {
        const coverData = await getCoverImages(selectedCoverId.value)
        coverImgLoaded.value = false
        coverImg.value = null
        coverImgFront.value = null
        coverImgBack.value = null
        mergedBitmap.value = null
        imageObj.value = null
        lastMergedImageSig.value = ''
        coverSourceMetaFront.value = createEmptyCoverSourceMeta()
        coverSourceMetaBack.value = createEmptyCoverSourceMeta()
        resetPlacementRect(gridPlacementRect)
        resetPlacementRect(tablePlacementRect)
        resetEffectPlacementRect()
        resetBackPlacementIssue()
        resetBackDerivedLayers()
        texts.value = []
        backTexts.value = []
        strokes.value = []
        backStrokes.value = []
        activeTextId.value = null
        activeText.value = null
        backActiveTextId.value = null
        backActiveText.value = null
        mergeLayer.w = 0
        mergeLayer.h = 0
        clearSelection()
        applySelection()
        const loadSide = async (blob, targetRef, metaRef) => {
          targetRef.value = null
          metaRef.value = createEmptyCoverSourceMeta()
          if(!blob) return
          const dpiInfo = await readCoverDpiFromBlob(blob)
          await new Promise(res => {
            const url = URL.createObjectURL(blob)
            const img = new Image()
            img.onload = () => {
              targetRef.value = img
              metaRef.value = buildCoverSourceMeta({
                widthPx: img.width,
                heightPx: img.height,
                dpiX: dpiInfo.dpiX,
                dpiY: dpiInfo.dpiY
              })
              URL.revokeObjectURL(url)
              res()
            }
            img.onerror = () => {
              URL.revokeObjectURL(url)
              res()
            }
            img.src = url
          })
        }
        // load both sides (front/back) if available
        await Promise.all([
          loadSide(coverData?.front?.blob, coverImgFront, coverSourceMetaFront),
          loadSide(coverData?.back?.blob, coverImgBack, coverSourceMetaBack)
        ])
        // decide active cover image
        if(activeSide.value==='front' && coverImgFront.value){ coverImg.value = coverImgFront.value; coverImgLoaded.value=true }
        else if(activeSide.value==='back' && coverImgBack.value){ coverImg.value = coverImgBack.value; coverImgLoaded.value=true }
        // initialize back derived layers if on back
        //  placements (effect / grid / table)
        try {
          const placements = coverData?.cover?.placements || []
          if(Array.isArray(placements)){
            syncCurrentCoverDesignSnapshot(coverData?.cover)
            // front effect -> mergeLayer (x,y,width,height)
            const eff = placements.find(p=>p.side==='front' && p.type==='effect')
            if(eff){
              effectPlacementRect.x = eff.x || 0
              effectPlacementRect.y = eff.y || 0
              effectPlacementRect.w = eff.width || 0
              effectPlacementRect.h = eff.height || 0
              effectPlacementRect.rotation = normalizeRotationValue(eff.rotation)
              effectPlacementRect.has = true
              mergeLayer.x = effectPlacementRect.x
              mergeLayer.y = effectPlacementRect.y
              mergeLayer.rotate = effectPlacementRect.rotation
              if(MERGE_DEBUG) console.log('[cover-compose]  effect placement', eff)
            }
            const grd = placements.find(p=>p.side==='back' && p.type==='grid')
            if(grd){
              gridPlacementRect.x = grd.x||0; gridPlacementRect.y = grd.y||0; gridPlacementRect.w = grd.width||0; gridPlacementRect.h = grd.height||0; gridPlacementRect.rotation = normalizeRotationValue(grd.rotation); gridPlacementRect.has = true;
              gridLayer.rotate = gridPlacementRect.rotation
            } else {
              if(coverImgBack.value) backPlacementIssue.missingGrid = true
              console.warn('[cover-compose] grid placement 不存在，停止自动布局')
            }
            const tbl = placements.find(p=>p.side==='back' && p.type==='table')
            if(tbl){
              tablePlacementRect.x = tbl.x||0; tablePlacementRect.y = tbl.y||0; tablePlacementRect.w = tbl.width||0; tablePlacementRect.h = tbl.height||0; tablePlacementRect.rotation = normalizeRotationValue(tbl.rotation); tablePlacementRect.has = true;
              tableLayer.rotate = tablePlacementRect.rotation
            } else {
              if(coverImgBack.value) backPlacementIssue.missingTable = true
              console.warn('[cover-compose] table placement 不存在，停止自动布局')
            }

            // ===  ===
            const frontTextPlacements = placements.filter(p=>p.side==='front' && p.type==='text')
            const backTextPlacements  = placements.filter(p=>p.side==='back' && p.type==='text')
            const makeTextObj = (p, isFront)=>{
              const id = 'cover-text-' + (p.id || (Date.now()+Math.random().toString(36).slice(2,7)))
              const payload = {
                id,
                type: 'text',
                draggable: true,
                text: resolveDefaultCoverText(p.text, isFront),
                x: p.x || 0,
                y: p.y || 0,
                placementId: p.id || null,
                placementW: p.width || 0,
                placementH: p.height || 0,
                fontSize: Number.isFinite(+p.fontSize) ? +p.fontSize : TEXT_DEFAULT_FONT_SIZE,
                color: typeof p.color === 'string' ? p.color : '#ffffff',
                fontFamily: resolveTextFontFamily(p.fontFamily),
                weight: 'normal',
                align: resolveTextAlignValue(p.align),
                rotate: normalizeRotationValue(p.rotation),
                baseline: 'alphabetic'
              }
              let obj
              try { obj = new TextObject(payload); obj.id = id } catch(e){ obj = payload }
              obj.align = resolveTextAlignValue(obj.align)
              recomputeTextMetrics(obj)
              obj.placementId = p.id || null
              obj.placementX = p.x || 0
              obj.placementY = p.y || 0
              obj.placementW = p.width || obj.w || 0
              obj.placementH = p.height || obj.h || 0
              obj.placementRotation = normalizeRotationValue(p.rotation)
              obj.manualPosition = false
              applyPlacementTextLayout(obj)
              if(MERGE_DEBUG){
                console.log('[cover-compose][text-placement]', {
                  id,
                  side: isFront ? 'front' : 'back',
                  placement: { x: p.x || 0, y: p.y || 0, width: p.width || obj.w || 0, height: p.height || obj.h || 0 },
                  metrics: { w: obj.w, h: obj.h, ascent: obj.ascent, descent: obj.descent, fontFamily: obj.fontFamily, align: obj.align },
                  resolved: { x: obj.x, y: obj.y }
                })
              }
              return obj
            }
            if(!restoreStoredFrontTexts(frontTextPlacements)){
              frontTextPlacements.forEach(p=>{ texts.value.push(makeTextObj(p, true)) })
            }
            if(!restoreStoredBackTexts(backTextPlacements)){
              backTextPlacements.forEach(p=>{ backTexts.value.push(makeTextObj(p, false)) })
            }
            restoreStoredStrokes(strokes, coverFrontDesign.strokes, 'front')
            restoreStoredStrokes(backStrokes, coverFrontDesign.backStrokes, 'back')
          }
        } catch(e){ console.warn('apply placements failed', e) }
        if(activeSide.value==='back'){
          ensureBackDerivedLayers('load-cover-back')
        }
        redraw()
        autoSelectTextForActiveSide({ focus: true })
      } catch(e){ console.warn('Failed to load cover images', e) }
    }
    if(mergedImage.value){
      applyMergedImageToBitmap(mergedImage.value)
    }
  } finally { loadingBase=false }
}

// 34
const lastMergedImageSig = ref('')
function clearMergedImageRenderState(){
  mergedBitmap.value = null
  imageObj.value = null
  lastMergedImageSig.value = ''
  mergeLayer.w = 0
  mergeLayer.h = 0

  const hasLoadedFrontCover = Number(coverSourceMetaFront.value?.widthPx) > 0 && Number(coverSourceMetaFront.value?.heightPx) > 0
  if(!hasLoadedFrontCover){
    coverImgFront.value = null
  }
  if(activeSide.value === 'front'){
    coverImg.value = coverImgFront.value || null
    coverImgLoaded.value = !!coverImg.value
  }

  if(getSelection()?.type === 'merge'){
    clearSelection()
    applySelection()
    return
  }
  redraw('mergedImage-cleared')
}

function applyMergedImageToBitmap(dataUrl){
  if(!dataUrl) return
  // dataUrl +
  const sig = String(dataUrl).slice(0, 64) + ':' + String(dataUrl).length
  if (sig === lastMergedImageSig.value && mergedBitmap.value) return

  const img = new Image()
  img.onload = () => {
    mergedBitmap.value = img
    ensureImageObject()
    lastMergedImageSig.value = sig

    const hasLoadedFrontCover = Number(coverSourceMetaFront.value?.widthPx) > 0 && Number(coverSourceMetaFront.value?.heightPx) > 0
    if(!hasLoadedFrontCover && !coverImgFront.value){
      coverImgFront.value = img
    }
    if(activeSide.value === 'front' && coverImgFront.value){
      coverImg.value = coverImgFront.value
      coverImgLoaded.value = true
    }

    mergeLayer.w = img.width || mergeLayer.w
    mergeLayer.h = img.height || mergeLayer.h

    if (restoreStoredMergeLayer()) {
      if(MERGE_DEBUG) console.log('[cover-compose] stored merge layer applied on merged bitmap load')
    } else if (hasEffectPlacement.value) {
      mergeTool && mergeTool.fitToPlacement(true)
    } else {
      mergeTool && mergeTool.reset(false)
    }

    redraw('mergedImage-updated')
  }
  img.onerror = () => { console.warn('[cover-compose] mergedImage load failed') }
  img.src = dataUrl
}

watch(
  () => mergedImage.value,
  (v) => {
    if(!v){
      clearMergedImageRenderState()
      return
    }
    applyMergedImageToBitmap(v)
  },
  { immediate: true }
)

// Recompute preview fit when active cover image changes.
watch(
  () => [coverImg.value, coverImgLoaded.value, activeSide.value],
  () => { nextTick(() => updateViewScale('cover-change')) },
  { immediate: true }
)

// 
function switchToFront(){
  if(activeSide.value==='front') return
  activeSide.value='front'
  if(coverImgFront.value){ coverImg.value=coverImgFront.value; coverImgLoaded.value=true }
  viewScaleMode.value = 'auto'
  updateViewScale('switch-front')
  applySelection(); redraw('switch-front')
  autoSelectTextForActiveSide({ focus: true })
}
function switchToBack(){
  if(activeSide.value==='back') return
  activeSide.value='back'
  if(coverImgBack.value){ coverImg.value=coverImgBack.value; coverImgLoaded.value=true }
  viewScaleMode.value = 'auto'
  updateViewScale('switch-back')
  if(!ensureBackDerivedLayersReady({ notify:true })){
    applySelection(); redraw('switch-back-missing-placement')
    autoSelectTextForActiveSide({ focus: true })
    return
  }
  ensureBackDerivedLayers('switch-back')
  applySelection(); redraw('switch-back')
  autoSelectTextForActiveSide({ focus: true })
}

/* ===== Persistence (front only) ===== */
// Removed obsolete persistTimer (handled by persistScheduler)
function schedulePersist(kind='auto'){ if(!persistCtrl) return; persistCtrl.schedule(kind) }

/* ===== Text selection ===== */
function applySelection(){
  const sel = getSelection();
  activeMerge.value = sel.type === 'merge';
  activeGrid.value = sel.type === 'grid';
  activeTable.value = sel.type === 'table';
  activeStrokeLayer.value = sel.type === 'strokes';
  if(sel.type === 'text'){
    if(activeSide.value==='front'){
      activeTextId.value = sel.id; activeText.value = texts.value.find(t=>t.id===sel.id)||null;
      backActiveTextId.value=null; backActiveText.value=null;
    } else {
      backActiveTextId.value = sel.id; backActiveText.value = backTexts.value.find(t=>t.id===sel.id)||null;
      activeTextId.value=null; activeText.value=null;
    }
  } else {
    activeTextId.value=null; activeText.value=null; backActiveTextId.value=null; backActiveText.value=null;
  }
  redraw();
}

function setActiveText(id){ selActivateText(id); applySelection() }
function setActiveBackText(id){ selActivateText(id); applySelection() }
function activateMerge(){ selActivateMerge(); applySelection() }
function activateGrid(){ selActivateGrid(); applySelection() }
function activateTable(){ selActivateTable(); applySelection(); nextTick(() => focusTableView()) }
function activateStrokeLayer(){ selActivateStrokes(); applySelection() }

function clearAllSelection(){ clearSelection(); applySelection() }

// === Text & Brush Actions () ===
function addText(){
  if(!coverImgLoaded.value) return
  const isFront = activeSide.value === 'front'
  const list = isFront ? texts.value : backTexts.value
  const id = 't'+Date.now()+Math.random().toString(36).slice(2,7)
  const payload = {
    id,
    type:'text',
    draggable:true,
    text: resolveDefaultCoverText('', isFront),
    x: 50,
    y: 50,
    fontSize: TEXT_DEFAULT_FONT_SIZE,
    color: '#ffffff',
    fontFamily: resolveTextFontFamily(),
    weight:'normal',
    align:'left',
    rotate: 0,
    baseline:'alphabetic'
  }
  let obj
  try { obj = new TextObject(payload); obj.id = id } catch(e){ obj = payload }
  obj.align = resolveTextAlignValue(obj.align)
  recomputeTextMetrics(obj)
  //  canvas 
  try {
    if(canvasRef.value){
      const layout = computeCenteredTextLayout(
        { x: 0, y: 0, width: canvasRef.value.width, height: canvasRef.value.height },
        obj.text,
        { fontSize: obj.fontSize, fontFamily: obj.fontFamily, weight: obj.weight },
        getTextMeasureCtx()
      )
      obj.x = layout.left
      obj.y = layout.baselineY
      obj.w = layout.width
      obj.h = layout.height
      obj.ascent = layout.ascent
      obj.descent = layout.descent
      obj.boxX = layout.left
      obj.boxY = layout.top
      obj.manualPosition = true
    }
  }catch(_){ }
  list.push(obj)
  selActivateText(id); applySelection(); schedulePersist('text'); redraw('add-text')
  focusActiveTextInput()
}
function recomputeTextMetrics(t){
  if(!t) return
  try {
    t.fontFamily = resolveTextFontFamily(t.fontFamily)
    t.align = resolveTextAlignValue(t.align)
    t.rotate = normalizeRotationValue(t.rotate)
    const metrics = measureTextMetrics(t)
    t.w = metrics.width
    t.h = metrics.height
    t.ascent = metrics.ascent
    t.descent = metrics.descent
  } catch(_) {}
}
function refreshLoadedTextLayouts(reason='text-font-ready'){
  texts.value.forEach(t=>{
    recomputeTextMetrics(t)
    if(!t.manualPosition) applyPlacementTextLayout(t)
    else pinManualTextPosition(t)
  })
  backTexts.value.forEach(t=>{
    recomputeTextMetrics(t)
    if(!t.manualPosition) applyPlacementTextLayout(t)
    else pinManualTextPosition(t)
  })
  redraw(reason)
}
function handleTextMutated(textObj, reason='text-mutated'){
  if(!textObj) return
  recomputeTextMetrics(textObj)
  if(!textObj.manualPosition) applyPlacementTextLayout(textObj)
  else pinManualTextPosition(textObj)
  redraw(reason)
}
function onCurrentTextChange(){
  if(currentActiveText.value){
    handleTextMutated(currentActiveText.value, 'text-change')
    schedulePersist('text')
  }
}
function toggleCurrentTextBold(){
  const t=currentActiveText.value
  if(!t) return
  t.weight = t.weight==='bold'? 'normal':'bold'
  handleTextMutated(t, 'text-bold')
  schedulePersist('text')
}
function removeCurrentText(){ const t=currentActiveText.value; if(!t) return; const list = activeSide.value==='front'? texts.value : backTexts.value; const i=list.findIndex(v=>v.id===t.id); if(i>-1){ list.splice(i,1); clearAllSelection(); schedulePersist('text'); redraw('text-remove') } }

function toggleBrushMode(){ brushMode.value = !brushMode.value; if(brushMode.value){ // 
  clearAllSelection(); selActivateStrokes(); applySelection();
  redraw('brush-on') } else { redraw('brush-off') } }
function clearCurrentStrokes(){ const arr = activeSide.value==='front'? strokes.value : backStrokes.value; if(arr.length){ arr.splice(0, arr.length); schedulePersist('strokes'); redraw('strokes-clear') } }

/* ===== Export ===== */
async function withExportRenderState(task){
  const prevSuppress = suppressSelectionOutlines.value
  try {
    suppressSelectionOutlines.value = true
    redraw('export-hide-selection-outlines')
    await waitRendered()
    return await task()
  } finally {
    suppressSelectionOutlines.value = prevSuppress
    redraw('export-restore-selection-outlines')
    await waitRendered()
  }
}

function exportImage(fmt='png'){
  if(!exportTool) return
  if(activeSide.value === 'back' && !ensureBackDerivedLayersReady({ notify:true })) return
  return withExportRenderState(async () => {
    try {
      await exportTool.exportImage(fmt)
    } catch(e) {
      console.error('[image export] failed', e)
      ElMessage.error(tr('merge.step4.exportAllFail', { msg: e?.message || tr('merge.step4.errUnknown') }))
    }
  })
}

function sanitizeExportBaseName(name){
  const raw = String(name || 'project').trim()
  const cleaned = raw
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'project'
}

function buildStep4ExportNames(projectName){
  const baseName = sanitizeExportBaseName(projectName)
  return {
    baseName,
    pdf: tr('merge.step4.exportZipPdfName', { name: baseName }),
    grid: tr('merge.step4.exportZipGridName', { name: baseName }),
    merged: tr('merge.step4.exportZipMergedName', { name: baseName }),
    zip: `${baseName}.zip`
  }
}

// PDF 
const pdfDialogVisible = ref(false)
const pdfFrontData = ref(null)
const pdfBackData = ref(null)
const pdfFrontRotate = ref(0) // 0/90/180/270
const pdfBackRotate = ref(0)
const pdfLoading = ref(false)
const pdfPaper = ref('A4') // 'A4' | 'A3'

//  jsPDF 
async function loadJsPDF(){
  if(window._jsPDFCtor) return window._jsPDFCtor
  try { const m = await import('jspdf'); const ctor = m.jsPDF || m.default; window._jsPDFCtor = ctor; return ctor } catch(e){ ElMessage.error(tr('merge.step4.jspdfMissing')); throw e }
}

//  jszip
async function loadJsZip(){
  if(window._jsZipCtor) return window._jsZipCtor
  try { const m = await import('jszip'); const ctor = m.default; window._jsZipCtor = ctor; return ctor } catch(e){ ElMessage.error(tr('merge.step4.jszipMissing')); throw e }
}
function rotateBitmapData(dataURL, deg){
  if(!dataURL) return Promise.resolve(dataURL)
  if(deg % 360 === 0) return Promise.resolve(dataURL)
  return new Promise(res=>{ const img=new Image(); img.onload=()=>{ const swap=(deg%180)!==0; const cw=swap? img.height: img.width; const ch=swap? img.width: img.height; const c=document.createElement('canvas'); c.width=cw; c.height=ch; const g=c.getContext('2d'); g.imageSmoothingQuality='high'; g.translate(cw/2,ch/2); g.rotate(deg*Math.PI/180); g.drawImage(img,-img.width/2,-img.height/2); res(c.toDataURL('image/jpeg',0.85)); }; img.src=dataURL })
}
//  &  JPEG
async function optimizeForPdf(dataURL, { maxDim=2000, quality=0.82 }={}){
  if(!dataURL) return dataURL
  return new Promise(res=>{ const img=new Image(); img.onload=()=>{ let {width:w,height:h}=img; const scale = Math.min(1, maxDim / Math.max(w,h)); const cw=Math.round(w*scale); const ch=Math.round(h*scale); const c=document.createElement('canvas'); c.width=cw; c.height=ch; const g=c.getContext('2d'); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; g.drawImage(img,0,0,cw,ch); res(c.toDataURL('image/jpeg', quality)); }; img.src=dataURL })
}

async function autoConfigurePdf(){
  // >90°
  const getDims = (data)=> new Promise(res=>{ if(!data) return res({w:0,h:0}); const img=new Image(); img.onload=()=>res({w:img.width,h:img.height}); img.src=data })
  const f = await getDims(pdfFrontData.value)
  const b = await getDims(pdfBackData.value)
  
  // >90°
  pdfFrontRotate.value = f.h > f.w ? 90 : 0
  pdfBackRotate.value  = b.h > b.w ? 90 : 0
  
  // 
  const name = currentCoverName.value.toLowerCase()
  if(name.includes('a3')){ pdfPaper.value='A3'; return }
  if(name.includes('a4')){ pdfPaper.value='A4'; return }
  const DPI = 150
  const A4PX = { w: Math.round(8.27 * DPI), h: Math.round(11.69 * DPI) }
  const maxW = Math.max(f.w, b.w)
  const maxH = Math.max(f.h, b.h)
  pdfPaper.value = (maxW <= A4PX.w && maxH <= A4PX.h) ? 'A4' : 'A3'
}

async function openPdfDialog(){
  if(!canvasRef.value){ ElMessage.error(tr('merge.step4.canvasNotReady')); return }
  
  // PDF
  try {
    await withExportRenderState(async () => {
      ElMessage.info(tr('merge.step4.pdfGenerating'))
      
      const frontData = await snapshotSide('front')
      const backData = await snapshotSide('back')
      
      await exportPdfDirect(frontData, backData)
    })
    
    ElMessage.success(tr('merge.step4.pdfExportOk'))
  } catch(e) {
    console.error('[PDF] export failed', e)
    if(!e?.handled) ElMessage.error(tr('merge.step4.pdfExportFail'))
  }
}

function pageStyle(rot){ return { transform:`rotate(${rot}deg)` } }
function rotateFront(){ pdfFrontRotate.value = (pdfFrontRotate.value + 90) % 360 }
function rotateBack(){ pdfBackRotate.value = (pdfBackRotate.value + 90) % 360 }

// 
async function waitRendered(){
  await nextTick();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}

//  captureSideImage
async function snapshotSide(side){
  const prev = activeSide.value
  const switching = prev !== side
  try {
    if(switching){
      activeSide.value = side
      if(side==='front' && coverImgFront.value) coverImg.value = coverImgFront.value
      else if(side==='back' && coverImgBack.value) coverImg.value = coverImgBack.value
    }
    if(side === 'back'){
      if(!ensureBackDerivedLayersReady({ notify:true })){
        throw createHandledError('BACK_PLACEMENT_INCOMPLETE', tr('merge.step4.backPlacementsMissingToast', { items: backPlacementMissingLabels.value }))
      }
      gridTool && gridTool.ensureGrid({ placement: gridPlacementRect })
      tableTool && tableTool.ensureTable({ placement: tablePlacementRect })
    }
    redraw(`pdf-snap-${switching ? 'switch' : 'refresh'}-${side}`)
    await waitRendered()
    return canvasRef.value?.toDataURL('image/png')
  } finally {
    if(switching){
      activeSide.value = prev
      if(prev==='front' && coverImgFront.value) coverImg.value = coverImgFront.value
      else if(prev==='back' && coverImgBack.value) coverImg.value = coverImgBack.value
      if(prev === 'back' && !hasBackPlacementIssue.value){
        gridTool && gridTool.ensureGrid({ placement: gridPlacementRect })
        tableTool && tableTool.ensureTable({ placement: tablePlacementRect })
      }
      redraw('pdf-snap-restore-'+prev)
      await waitRendered()
    }
  }
}


async function captureSideImage(side){ return snapshotSide(side) }

// PDF- 
async function exportPdfDirect(frontData, backData){
  const blob = await generatePdfBlob(frontData, backData)
  const pdfUrl = URL.createObjectURL(blob)
  const pdfLink = document.createElement('a')
  const exportNames = buildStep4ExportNames(selectedProject.value?.name)
  pdfLink.href = pdfUrl
  pdfLink.download = exportNames.pdf
  pdfLink.style.display = 'none'
  document.body.appendChild(pdfLink)
  
  console.log('[exportPdfDirect] PDF download:', pdfLink.download)
  pdfLink.click()
  
  // 
  setTimeout(() => {
    document.body.removeChild(pdfLink)
    URL.revokeObjectURL(pdfUrl)
    console.log('[exportPdfDirect] PDF download done')
  }, 500)
}

onMounted(()=>{ 
  rendererCtrl = createRendererController({ canvasRef, coverImg, imageObj, mergeLayer, gridLayer, tableLayer, gridObj, tableObj, strokeLayerObj, activeSide, currentTexts, currentActiveText, activeMerge, activeGrid, activeTable, currentStrokes, suppressSelectionOutlines })
  persistCtrl = createPersistScheduler({ activeSide, mergeLayer, gridLayer, tableLayer, texts, backTexts, strokes, backStrokes, coverFrontDesign, updateCoverFrontDesign, selectedCoverId })
  textTool = createTextTool({ activeSide, coverImg, texts, backTexts, measureTextWidth, schedulePersist, redraw, setActiveFrontText, setActiveBackText: setActiveBackTextWrapper })
  strokeTool = createStrokeTool({ activeSide, strokes, backStrokes, schedulePersist, redraw, brushMode, brushColor, brushSize })
  gridTool = createGridTool({ activeSide, coverImg, gridLayer, gridObj, gridGenerator, activeGrid, cellsData, selectedProject, setCellsData, redraw })
  tableTool = createTableTool({ activeSide, coverImg, tableLayer, tableObj, tableGenerator, activeTable, cellsData, selectedProject, setCellsData, redraw })
  mergeTool = createMergeLayerTool({ coverImg, mergedBitmap, mergeLayer, activeSide, schedulePersist, redraw, effectPlacementRect })
  interaction = createInteractionController({ canvasRef, activeSide, brushMode, brushColor, brushSize, strokeTool, gridTool, mergeTool, gridLayer, tableLayer, mergeLayer, imageObj, gridObj, tableObj, texts, backTexts, currentTexts, currentActiveText, activeMerge, activeStrokeLayer, activeGrid, activeTable, activeTextId, activeText, backActiveTextId, backActiveText, setActiveText, setActiveBackText, activateMerge, activateGrid, activateTable, schedulePersist, onTextMutated: handleTextMutated, redraw, draggingMerge, coverImg })
  exportTool = createExportTool({
    canvasRef,
    activeSide,
    getImageExportConfig,
    addPngDpiToBlob: addDpiToPngBlob,
    addJpegDpiToBlob: addDpiToJpegBlob
  })
  bus.on(EVENTS.SELECTION_CHANGED, applySelection)
  // Fit-to-viewport observer (preview only)
  try {
    const ro = new ResizeObserver(() => updateViewScale('resize'))
    if (zoneRef.value) ro.observe(zoneRef.value)
    if (wrapperRef.value) ro.observe(wrapperRef.value)
    onBeforeUnmount(() => { try { ro.disconnect() } catch(_) {} })
  } catch(_) {}

  loadCover(); ensureImageObject(); redraw(); 
  nextTick(() => updateViewScale('mounted'))
  persistCtrl.reset(coverFrontDesign)
  ensureCoverTextFontReady().then(() => {
    refreshLoadedTextLayouts('text-font-ready')
  })
})

onBeforeUnmount(()=>{
  bus.off && bus.off(EVENTS.SELECTION_CHANGED, applySelection)
  releaseCoverThumbUrls()
})

//  ID  coverFormatId 
const formatCoverId = (id)=>{ if(id==null) return '-'; const s=String(id); return s.length>10? s.slice(0,4)+'...'+s.slice(-3): s }
// 
const coverFormatId = formatCoverId

// ===== Pointer event wrappers (improved to restore dragging) =====
function _dispatchPointer(methodList, e){ if(!interaction) return; for(const m of methodList){ const fn = interaction[m]; if(typeof fn==='function'){ return fn(e) } } }
function onPointerDown(e){ e.preventDefault(); e.stopPropagation(); try{ canvasRef.value?.setPointerCapture?.(e.pointerId) }catch(_){} _dispatchPointer(['pointerDown','onPointerDown'], e) }
function onPointerMove(e){ e.preventDefault(); _dispatchPointer(['pointerMove','onPointerMove'], e) }
function onPointerUp(e){ e.preventDefault(); try{ canvasRef.value?.releasePointerCapture?.(e.pointerId) }catch(_){} _dispatchPointer(['pointerUp','onPointerUp'], e) }
function onPointerLeave(e){ _dispatchPointer(['pointerLeave','onPointerLeave'], e) }
function normalizeWheelDelta(e, zone){
  const lineStep = 16
  const pageWidth = Math.max(1, zone?.clientWidth || 0)
  const pageHeight = Math.max(1, zone?.clientHeight || 0)
  const factor = e.deltaMode === 1 ? lineStep : (e.deltaMode === 2 ? pageHeight : 1)
  return {
    x: (Number(e.deltaX) || 0) * (e.deltaMode === 2 ? pageWidth : factor),
    y: (Number(e.deltaY) || 0) * factor
  }
}
function scrollCanvasViewportByWheel(e){
  const zone = zoneRef.value
  if(!zone) return false
  const beforeLeft = zone.scrollLeft
  const beforeTop = zone.scrollTop
  const delta = normalizeWheelDelta(e, zone)
  let nextLeft = delta.x
  let nextTop = delta.y

  if(!nextLeft && e.shiftKey && nextTop){
    nextLeft = nextTop
    nextTop = 0
  }

  if(nextLeft){
    zone.scrollLeft += nextLeft
  }
  if(nextTop){
    zone.scrollTop += nextTop
  }

  return zone.scrollLeft !== beforeLeft || zone.scrollTop !== beforeTop
}
function onCanvasWheel(e){
  const handled = _dispatchPointer(['wheel','onWheel'], e)
  if(handled){
    e.preventDefault()
    e.stopPropagation()
    return
  }
  if(scrollCanvasViewportByWheel(e)){
    e.preventDefault()
    e.stopPropagation()
  }
}


const exportDialogVisible = ref(false)
const exportGridEnabled = ref(true)
//  PDF  300 DPI
const exportDpi = ref(300)
const gridExportWidth = ref(0)   // 
const gridExportHeight = ref(0)  // 
const gridExportStroke = ref(true)
const gridExportStrokeColor = ref('#0066ff')
const gridExportStrokeSize = ref(5)
const exportingAll = ref(false)

//  &  DPI 
const GRID_BASE_DPI = 300
const gridBaseWidth = ref(0)
const gridBaseHeight = ref(0)
const gridBaseWidthCm = ref(0)
const gridBaseHeightCm = ref(0)

// cm
const gridExportWidthCm = ref(0)
const gridExportHeightCm = ref(0)
const suppressSelectionOutlines = ref(false)

const CM_PER_INCH = 2.54
const GRID_EXPORT_SANITY_MIN_PX = 64

function createEmptyCoverSourceMeta(){
  return {
    widthPx: 0,
    heightPx: 0,
    dpiX: DEFAULT_COVER_EXPORT_DPI,
    dpiY: DEFAULT_COVER_EXPORT_DPI,
    dpi: DEFAULT_COVER_EXPORT_DPI,
    widthMm: 0,
    heightMm: 0
  }
}

function normalizeCoverDpiValue(value){
  const dpi = Number(value)
  if(!Number.isFinite(dpi) || dpi <= 1 || dpi > 2400) return DEFAULT_COVER_EXPORT_DPI
  return dpi
}

function buildCoverSourceMeta({ widthPx = 0, heightPx = 0, dpiX = DEFAULT_COVER_EXPORT_DPI, dpiY = DEFAULT_COVER_EXPORT_DPI } = {}){
  const safeWidth = Math.max(0, Math.round(Number(widthPx) || 0))
  const safeHeight = Math.max(0, Math.round(Number(heightPx) || 0))
  const safeDpiX = normalizeCoverDpiValue(dpiX)
  const safeDpiY = normalizeCoverDpiValue(dpiY)
  return {
    widthPx: safeWidth,
    heightPx: safeHeight,
    dpiX: safeDpiX,
    dpiY: safeDpiY,
    dpi: Math.round((safeDpiX + safeDpiY) / 2),
    widthMm: safeWidth > 0 ? (safeWidth / safeDpiX) * 25.4 : 0,
    heightMm: safeHeight > 0 ? (safeHeight / safeDpiY) * 25.4 : 0
  }
}

function readUint32BE(bytes, offset){
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  )
}

async function readCoverDpiFromBlob(blob){
  if(!blob) return { dpiX: DEFAULT_COVER_EXPORT_DPI, dpiY: DEFAULT_COVER_EXPORT_DPI }
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if(bytes.length < 16) return { dpiX: DEFAULT_COVER_EXPORT_DPI, dpiY: DEFAULT_COVER_EXPORT_DPI }
    const mime = String(blob.type || '').toLowerCase()
    if(mime === 'image/png'){
      const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
      const isPng = sig.every((value, index) => bytes[index] === value)
      if(isPng){
        let offset = 8
        while(offset + 8 <= bytes.length){
          const length = readUint32BE(bytes, offset)
          const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
          if(type === 'pHYs' && length >= 9 && offset + 8 + length <= bytes.length){
            const xPpm = readUint32BE(bytes, offset + 8)
            const yPpm = readUint32BE(bytes, offset + 12)
            const unit = bytes[offset + 16]
            if(unit === 1){
              return {
                dpiX: xPpm / 39.3701,
                dpiY: yPpm / 39.3701
              }
            }
            break
          }
          offset += 12 + length
        }
      }
    }
    if(mime === 'image/jpeg'){
      let offset = 2
      while(offset + 4 < bytes.length && bytes[offset] === 0xFF){
        const marker = bytes[offset + 1]
        if(marker === 0xDA || marker === 0xD9) break
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
        if(length < 2 || offset + 2 + length > bytes.length) break
        const isJfif =
          marker === 0xE0 &&
          bytes[offset + 4] === 0x4A &&
          bytes[offset + 5] === 0x46 &&
          bytes[offset + 6] === 0x49 &&
          bytes[offset + 7] === 0x46 &&
          bytes[offset + 8] === 0x00
        if(isJfif && offset + 15 < bytes.length){
          const unit = bytes[offset + 11]
          const xDensity = (bytes[offset + 12] << 8) | bytes[offset + 13]
          const yDensity = (bytes[offset + 14] << 8) | bytes[offset + 15]
          if(unit === 1){
            return { dpiX: xDensity, dpiY: yDensity }
          }
          if(unit === 2){
            return { dpiX: xDensity * 2.54, dpiY: yDensity * 2.54 }
          }
          break
        }
        offset += 2 + length
      }
    }
  } catch(_) {}
  return { dpiX: DEFAULT_COVER_EXPORT_DPI, dpiY: DEFAULT_COVER_EXPORT_DPI }
}

function getCoverSourceMetaBySide(side){
  return side === 'back' ? coverSourceMetaBack.value : coverSourceMetaFront.value
}

function resolvePrimaryCoverSourceMeta(frontDims, backDims){
  const candidates = [coverSourceMetaFront.value, coverSourceMetaBack.value].filter(meta => meta?.widthPx > 0 && meta?.heightPx > 0)
  if(!candidates.length) return null
  const targetW = frontDims?.w > 0 ? frontDims.w : (backDims?.w || 0)
  const targetH = frontDims?.h > 0 ? frontDims.h : (backDims?.h || 0)
  if(targetW > 0 && targetH > 0){
    const matched = candidates.find(meta => meta.widthPx === targetW && meta.heightPx === targetH)
    if(matched) return matched
  }
  return candidates[0]
}

function getImageExportConfig(){
  const meta = getCoverSourceMetaBySide(activeSide.value)
  if(!meta?.widthPx || !meta?.heightPx) return null
  return { dpi: meta.dpi }
}

function getPdfPageSpec(frontDims, backDims, dpiOverride){
  const meta = resolvePrimaryCoverSourceMeta(frontDims, backDims)
  if(meta?.widthPx > 0 && meta?.heightPx > 0){
    return {
      pageW: meta.widthMm,
      pageH: meta.heightMm,
      orientation: meta.widthMm > meta.heightMm ? 'landscape' : 'portrait',
      format: [meta.widthMm, meta.heightMm],
      paperLabel: `${meta.widthPx}x${meta.heightPx}@${meta.dpi}dpi`,
      source: 'cover'
    }
  }

  const sizeMap = {
    A4: { w: 210, h: 297 },
    A3: { w: 297, h: 420 }
  }
  const maxW = Math.max(frontDims?.w || 0, backDims?.w || 0)
  const maxH = Math.max(frontDims?.h || 0, backDims?.h || 0)
  const fallbackDpi = normalizeCoverDpiValue(dpiOverride || exportDpi.value || GRID_BASE_DPI)
  if(maxW > 0 && maxH > 0){
    const widthMm = (maxW / fallbackDpi) * 25.4
    const heightMm = (maxH / fallbackDpi) * 25.4
    return {
      pageW: widthMm,
      pageH: heightMm,
      orientation: widthMm > heightMm ? 'landscape' : 'portrait',
      format: [widthMm, heightMm],
      paperLabel: `${maxW}x${maxH}@${fallbackDpi}dpi`,
      source: 'pixel-fallback'
    }
  }
  const base = sizeMap.A4
  const orientation = maxW > maxH ? 'landscape' : 'portrait'
  const pageW = orientation === 'landscape' ? base.h : base.w
  const pageH = orientation === 'landscape' ? base.w : base.h
  return {
    pageW,
    pageH,
    orientation,
    format: [pageW, pageH],
    paperLabel: 'A4',
    source: 'paper'
  }
}

// ====== 4 ======
const STEP4_EXPORT_MEM_KEY = 'easystitch.merge.step4.export.memory.v1'
const exportMemLoaded = ref(false)
const STEP4_EXPORT_DEFAULTS = Object.freeze({
  exportDpi: 300,
  exportGridEnabled: true,
  gridExportStroke: true,
  gridExportStrokeColor: '#0066ff',
  gridExportStrokeSize: 5
})
function loadStep4ExportMemory(){
  if (exportMemLoaded.value) return
  exportMemLoaded.value = true
  try {
    const raw = localStorage.getItem(STEP4_EXPORT_MEM_KEY)
    if(!raw) return
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return
    if (Number.isFinite(Number(obj.exportDpi))) exportDpi.value = Math.max(72, Math.min(1200, Math.round(Number(obj.exportDpi))))
    if (Number.isFinite(Number(obj.gridExportWidthCm))) gridExportWidthCm.value = Math.max(0.1, Number(obj.gridExportWidthCm))
    if (Number.isFinite(Number(obj.gridExportHeightCm))) gridExportHeightCm.value = Math.max(0.1, Number(obj.gridExportHeightCm))
    if (typeof obj.gridExportStroke === 'boolean') gridExportStroke.value = obj.gridExportStroke
    if (typeof obj.gridExportStrokeColor === 'string' && obj.gridExportStrokeColor) gridExportStrokeColor.value = obj.gridExportStrokeColor
    if (Number.isFinite(Number(obj.gridExportStrokeSize))) gridExportStrokeSize.value = Math.max(1, Math.min(200, Math.round(Number(obj.gridExportStrokeSize))))
  } catch(_) {}
}
function saveStep4ExportMemory(){
  try {
    localStorage.setItem(STEP4_EXPORT_MEM_KEY, JSON.stringify({
      exportDpi: Number(exportDpi.value),
      gridExportWidthCm: Number(gridExportWidthCm.value),
      gridExportHeightCm: Number(gridExportHeightCm.value),
      gridExportStroke: !!gridExportStroke.value,
      gridExportStrokeColor: String(gridExportStrokeColor.value || ''),
      gridExportStrokeSize: Number(gridExportStrokeSize.value)
    }))
  } catch(_) {}
}

function resetStep4ExportMemory(){
  try { localStorage.removeItem(STEP4_EXPORT_MEM_KEY) } catch(_) {}
  exportDpi.value = STEP4_EXPORT_DEFAULTS.exportDpi
  exportGridEnabled.value = STEP4_EXPORT_DEFAULTS.exportGridEnabled
  gridExportStroke.value = STEP4_EXPORT_DEFAULTS.gridExportStroke
  gridExportStrokeColor.value = STEP4_EXPORT_DEFAULTS.gridExportStrokeColor
  gridExportStrokeSize.value = STEP4_EXPORT_DEFAULTS.gridExportStrokeSize
  //  cm
  gridExportWidthCm.value = 0
  gridExportHeightCm.value = 0
  // 
  nextTick(() => { try { syncGridSizePxFromCmAndDpi() } catch(_) {} })
}

function syncGridBaseSizeCm(){
  const baseW = gridBaseWidth.value
  const baseH = gridBaseHeight.value
  if(!baseW || !baseH) return
  //  DPI cm
  const wInch = baseW / GRID_BASE_DPI
  const hInch = baseH / GRID_BASE_DPI
  gridBaseWidthCm.value = wInch * CM_PER_INCH
  gridBaseHeightCm.value = hInch * CM_PER_INCH
  //  = “”
  if(!gridExportWidthCm.value) gridExportWidthCm.value = parseFloat(gridBaseWidthCm.value.toFixed(2))
  if(!gridExportHeightCm.value) gridExportHeightCm.value = parseFloat(gridBaseHeightCm.value.toFixed(2))
}

function getGridExportPxFromState(dpiOverride){
  const dpi = dpiOverride || exportDpi.value || GRID_BASE_DPI
  const wCm = gridExportWidthCm.value || gridBaseWidthCm.value
  const hCm = gridExportHeightCm.value || gridBaseHeightCm.value
  if(!wCm || !hCm || !dpi) return { w: 0, h: 0 }
  const wInch = wCm / CM_PER_INCH
  const hInch = hCm / CM_PER_INCH
  return {
    w: Math.max(1, Math.round(wInch * dpi)),
    h: Math.max(1, Math.round(hInch * dpi))
  }
}

//  cm  +  DPI
function syncGridSizePxFromCmAndDpi(){
  const { w, h } = getGridExportPxFromState()
  if(!w || !h) return
  gridExportWidth.value = w
  gridExportHeight.value = h
}

function repairTinyGridExportSizeFromBase(){
  if(!gridBaseWidthCm.value || !gridBaseHeightCm.value) return false
  const { w, h } = getGridExportPxFromState()
  if(w >= GRID_EXPORT_SANITY_MIN_PX && h >= GRID_EXPORT_SANITY_MIN_PX) return false
  gridExportWidthCm.value = parseFloat(gridBaseWidthCm.value.toFixed(2))
  gridExportHeightCm.value = parseFloat(gridBaseHeightCm.value.toFixed(2))
  syncGridSizePxFromCmAndDpi()
  console.warn('[export] tiny grid export size repaired from base image size', {
    repairedFromPx: { w, h },
    repairedToPx: { w: gridExportWidth.value, h: gridExportHeight.value }
  })
  return true
}

//  DPI  cm  DPI 
watch(exportDpi, () => {
  syncGridSizePxFromCmAndDpi()
})

watch([gridExportWidthCm, gridExportHeightCm], () => {
  syncGridSizePxFromCmAndDpi()
})

function openExportDialog(){
  try {
    if(!ensureBackDerivedLayersReady({ notify:true })) return
    //  syncGridBaseSizeCm 
    loadStep4ExportMemory()
    exportDialogVisible.value = true
    //  projectImage 
    const projImg = projectImage?.value
    if(projImg){
      const img = new Image()
      img.onload = ()=>{
        gridBaseWidth.value = img.width
        gridBaseHeight.value = img.height
        // cm DPI 
        syncGridBaseSizeCm()
        syncGridSizePxFromCmAndDpi()
        repairTinyGridExportSizeFromBase()
      }
      img.src = projImg
    } else {
      //  10cm
      const defaultCm = 10
      gridBaseWidthCm.value = defaultCm
      gridBaseHeightCm.value = defaultCm
      if(!gridExportWidthCm.value) gridExportWidthCm.value = defaultCm
      if(!gridExportHeightCm.value) gridExportHeightCm.value = defaultCm
      syncGridSizePxFromCmAndDpi()
    }
  } catch(e){ console.error('[export] openExportDialog', e) }
}

// 
onMounted(() => { loadStep4ExportMemory() })
watch([exportDpi, gridExportWidthCm, gridExportHeightCm, gridExportStroke, gridExportStrokeColor, gridExportStrokeSize], () => {
  saveStep4ExportMemory()
})

async function confirmExportAll(){
  exportingAll.value = true
  try {
    console.log('[confirmExportAll] start')
    await withExportRenderState(async () => {
      ElMessage.info(tr('merge.step4.packExporting'))
      
      const frontData = await snapshotSide('front')
      const backData = await snapshotSide('back')
      
      const exportNames = buildStep4ExportNames(selectedProject.value?.name)
      
      console.log('[confirmExportAll] generating PDF')
      const pdfBlob = await generatePdfBlob(frontData, backData)
      console.log('[confirmExportAll] PDF done')
      
      let gridPngBlob = null
      if(exportGridEnabled.value){
        console.log('[confirmExportAll] generating grid PNG')
        gridPngBlob = await generateGridPngBlob()
        console.log('[confirmExportAll] grid PNG done')
      }

      let mergedPngBlob = null
      if(mergedImage.value){
        console.log('[confirmExportAll] attaching merged PNG')
        mergedPngBlob = await dataUrlToBlob(mergedImage.value)
      }
      
      console.log('[confirmExportAll] packaging ZIP')
      const JsZip = await loadJsZip()
      const zip = new JsZip()
      
      zip.file(exportNames.pdf, pdfBlob)
      
      if(gridPngBlob){
        zip.file(exportNames.grid, gridPngBlob)
      }
      if(mergedPngBlob){
        zip.file(exportNames.merged, mergedPngBlob)
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      const zipLink = document.createElement('a')
      zipLink.href = zipUrl
      zipLink.download = exportNames.zip
      zipLink.style.display = 'none'
      document.body.appendChild(zipLink)
      
      console.log('[confirmExportAll] ZIP download:', zipLink.download)
      zipLink.click()
      
      setTimeout(() => {
        document.body.removeChild(zipLink)
        URL.revokeObjectURL(zipUrl)
        console.log('[confirmExportAll] ZIP done')
      }, 500)
    })
    
    ElMessage.success(tr('merge.step4.exportAllOk'))
    exportDialogVisible.value = false
  } catch(e){
    console.error('[confirmExportAll] error:', e.message, e.stack)
    if(!e?.handled) ElMessage.error(tr('merge.step4.exportAllFail', { msg: e.message || tr('merge.step4.errUnknown') }))
  } finally {
    exportingAll.value = false
  }
}

//  PDF Blob
async function generatePdfBlob(frontData, backData, dpiOverride){
  const JsPDF = await loadJsPDF()
  
  const getDims = (data)=> new Promise(res=>{ if(!data) return res({w:0,h:0}); const img=new Image(); img.onload=()=>res({w:img.width,h:img.height}); img.src=data })
  const f = await getDims(frontData)
  const b = await getDims(backData)

  // PNG
  const frontOptim = frontData
  const backOptim  = backData
  const pageSpec = getPdfPageSpec(f, b, dpiOverride)
  const pageW = pageSpec.pageW
  const pageH = pageSpec.pageH
  
  const pdf = new JsPDF({
    orientation: pageSpec.orientation,
    unit: 'mm',
    format: pageSpec.format,
    compress: false //  jsPDF 
  })
  pdf.addImage(frontOptim,'PNG',0,0,pageW,pageH, undefined, 'FAST')
  
  pdf.addPage(pageSpec.format, pageSpec.orientation)
  pdf.addImage(backOptim ,'PNG',0,0,pageW,pageH, undefined, 'FAST')
  
  return pdf.output('blob')
}

// ===== PNG  PNG Blob  pHYs (DPI) =====
function crc32(buf) {
  let table = crc32._table
  if (!table) {
    table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      }
      table[i] = c >>> 0
    }
    crc32._table = table
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

async function addDpiToPngBlob(blob, dpi) {
  if (!blob || blob.type !== 'image/png') return blob
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // PNG signature
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== sig[i]) {
      console.warn('[addDpiToPngBlob] not a PNG, skip')
      return blob
    }
  }

  //  IHDR  IHDR 
  const ihdrLen =
    (bytes[8] << 24) |
    (bytes[9] << 16) |
    (bytes[10] << 8) |
    (bytes[11])
  const ihdrTotal = 12 + ihdrLen
  const ihdrEnd = 8 + ihdrTotal //  IHDR  pHYs

  const ppu = Math.max(1, Math.round((dpi || 300) * 39.3701)) // pixels per meter
  const data = new Uint8Array(9)
  // X pixels per unit
  data[0] = (ppu >>> 24) & 0xFF
  data[1] = (ppu >>> 16) & 0xFF
  data[2] = (ppu >>> 8) & 0xFF
  data[3] = (ppu) & 0xFF
  // Y pixels per unit
  data[4] = (ppu >>> 24) & 0xFF
  data[5] = (ppu >>> 16) & 0xFF
  data[6] = (ppu >>> 8) & 0xFF
  data[7] = (ppu) & 0xFF
  // unit: 1 = meter
  data[8] = 1

  const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]) // "pHYs"
  const lenBytes = new Uint8Array(4)
  const chunkLen = data.length // 9
  lenBytes[0] = (chunkLen >>> 24) & 0xFF
  lenBytes[1] = (chunkLen >>> 16) & 0xFF
  lenBytes[2] = (chunkLen >>> 8) & 0xFF
  lenBytes[3] = (chunkLen) & 0xFF

  const crcInput = new Uint8Array(type.length + data.length)
  crcInput.set(type, 0)
  crcInput.set(data, type.length)
  const crcVal = crc32(crcInput)
  const crcBytes = new Uint8Array(4)
  crcBytes[0] = (crcVal >>> 24) & 0xFF
  crcBytes[1] = (crcVal >>> 16) & 0xFF
  crcBytes[2] = (crcVal >>> 8) & 0xFF
  crcBytes[3] = (crcVal) & 0xFF

  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  let off = 0
  chunk.set(lenBytes, off); off += 4
  chunk.set(type, off);     off += 4
  chunk.set(data, off);     off += data.length
  chunk.set(crcBytes, off)

  const out = new Uint8Array(bytes.length + chunk.length)
  // IHDR  + IHDR 
  out.set(bytes.subarray(0, ihdrEnd), 0)
  // pHYs
  out.set(chunk, ihdrEnd)
  //  chunk
  out.set(bytes.subarray(ihdrEnd), ihdrEnd + chunk.length)

  return new Blob([out], { type: 'image/png' })
}

async function addDpiToJpegBlob(blob, dpi) {
  if (!blob || blob.type !== 'image/jpeg') return blob
  const density = Math.max(1, Math.min(65535, Math.round(dpi || 300)))
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return blob

  let offset = 2
  while (offset + 4 < bytes.length && bytes[offset] === 0xFF) {
    const marker = bytes[offset + 1]
    if (marker === 0xDA || marker === 0xD9) break
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (length < 2 || offset + 2 + length > bytes.length) break
    const isJfif =
      marker === 0xE0 &&
      bytes[offset + 4] === 0x4A &&
      bytes[offset + 5] === 0x46 &&
      bytes[offset + 6] === 0x49 &&
      bytes[offset + 7] === 0x46 &&
      bytes[offset + 8] === 0x00
    if (isJfif && offset + 15 < bytes.length) {
      const out = bytes.slice()
      out[offset + 11] = 1
      out[offset + 12] = (density >>> 8) & 0xFF
      out[offset + 13] = density & 0xFF
      out[offset + 14] = (density >>> 8) & 0xFF
      out[offset + 15] = density & 0xFF
      return new Blob([out], { type: 'image/jpeg' })
    }
    offset += 2 + length
  }

  const jfifSegment = new Uint8Array([
    0xFF, 0xE0,
    0x00, 0x10,
    0x4A, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01,
    0x01,
    (density >>> 8) & 0xFF,
    density & 0xFF,
    (density >>> 8) & 0xFF,
    density & 0xFF,
    0x00, 0x00
  ])
  const out = new Uint8Array(bytes.length + jfifSegment.length)
  out.set(bytes.subarray(0, 2), 0)
  out.set(jfifSegment, 2)
  out.set(bytes.subarray(2), 2 + jfifSegment.length)
  return new Blob([out], { type: 'image/jpeg' })
}

//  PNG Blob
async function generateGridPngBlob(){
  const projImg = projectImage?.value
  if(!projImg){ 
    throw new Error(tr('merge.step4.errNoGridData'))
  }
  const w = Math.max(1, parseInt(gridExportWidth.value)||1)
  const h = Math.max(1, parseInt(gridExportHeight.value)||1)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  
  return new Promise((resolve, reject)=>{
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = ()=>{
      try {
        g.drawImage(img, 0, 0, w, h)
        // 
        if(gridExportStroke.value){
          g.save()
          g.strokeStyle = gridExportStrokeColor.value
          g.lineWidth = gridExportStrokeSize.value
          const half = gridExportStrokeSize.value / 2
          g.strokeRect(half, half, w - gridExportStrokeSize.value, h - gridExportStrokeSize.value)
          g.restore()
        }
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error(tr('merge.step4.errCanvasToBlob')))
            return
          }
          try {
            const dpi = exportDpi.value || GRID_BASE_DPI
            const blobWithDpi = await addDpiToPngBlob(blob, dpi)
            resolve(blobWithDpi)
          } catch (e) {
            console.warn('[generateGridPngBlob] write DPI failed, using raw PNG', e)
            resolve(blob)
          }
        }, 'image/png')
      } catch(e) {
        reject(e)
      }
    }
    img.onerror = (err)=>{
      reject(new Error(tr('merge.step4.errGridImageLoad')))
    }
    img.src = projImg
  })
}

async function dataUrlToBlob(dataUrl){
  if(!dataUrl) return null
  if(/^data:/i.test(dataUrl)){
    const base64Match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/i)
    if(base64Match){
      const mime = base64Match[1]
      const binary = atob(base64Match[2])
      const bytes = new Uint8Array(binary.length)
      for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type: mime })
    }
    const textMatch = dataUrl.match(/^data:([^;,]+)?,(.*)$/i)
    if(textMatch){
      const mime = textMatch[1] || 'application/octet-stream'
      const text = decodeURIComponent(textMatch[2] || '')
      return new Blob([text], { type: mime })
    }
    throw new Error('无效的 dataURL 格式')
  }
  const response = await fetch(dataUrl)
  return response.blob()
}

</script>
<style scoped>
.cover-compose-root {
  --compose-surface: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,250,252,0.82));
  --compose-surface-strong: rgba(255,255,255,0.94);
  --compose-surface-soft: rgba(248,250,252,0.72);
  --compose-border: rgba(148,163,184,0.22);
  --compose-border-strong: rgba(148,163,184,0.32);
  --compose-text: #172033;
  --compose-text-soft: #526072;
  --compose-text-muted: #7c8b9d;
  --compose-primary: #2563eb;
  --compose-primary-strong: #1d4ed8;
  --compose-shadow: 0 24px 48px -34px rgba(15,23,42,0.34);
  --compose-shadow-strong: 0 28px 56px -36px rgba(15,23,42,0.38);
  --compose-control-h: 42px;
  --compose-control-radius: 12px;
  --compose-gap: 12px;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--compose-text);
}
.select-overlay {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(96px, 12vh, 148px) clamp(20px, 3vw, 32px) clamp(28px, 6vh, 56px);
  box-sizing: border-box;
  overflow: auto;
}
.select-box {
  width: min(100%, 720px);
  text-align:center;
  background: var(--compose-surface);
  padding: clamp(40px, 6vw, 60px) clamp(28px, 7vw, 100px);
  border:1px solid var(--compose-border);
  border-radius:28px;
  backdrop-filter:blur(18px);
  box-shadow: var(--compose-shadow-strong);
}
.select-box h2 {
  margin: 0 0 14px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--compose-text);
}
.select-box .sub {
  margin: 0 auto 28px;
  max-width: 28em;
  line-height: 1.6;
  color: var(--compose-text-soft);
}
.editor-layout { display:flex; flex-direction:column; height:100%; min-height:0; gap:16px; }
.topbar {
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:12px 16px;
  padding:14px 18px;
  border:1px solid var(--compose-border);
  border-radius:24px;
  background: var(--compose-surface);
  backdrop-filter: blur(18px);
  box-shadow: var(--compose-shadow);
}
.stage-toolbar {
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:12px 16px;
  padding:12px 16px;
  border:1px solid var(--compose-border);
  border-radius:22px;
  background: var(--compose-surface-soft);
  box-shadow: var(--compose-shadow);
  backdrop-filter: blur(16px);
}
.stage-toolbar-left,
.stage-toolbar-right {
  display:flex;
  align-items:center;
  gap:12px;
  min-width:0;
}
.topbar .left-group,
.topbar .right-group {
  display:flex;
  flex-wrap:wrap;
  align-items: stretch;
  gap: var(--compose-gap);
}
.topbar :deep(.el-button) {
  min-height: var(--compose-control-h);
  padding-inline: 16px;
  border-radius: var(--compose-control-radius);
  font-weight: 600;
  border-color: rgba(191, 219, 254, 0.4);
}
.topbar :deep(.el-button--default) {
  background: rgba(255,255,255,0.8);
  color: var(--compose-text);
}
.topbar :deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--compose-primary), #3b82f6);
  border-color: transparent;
  box-shadow: 0 18px 28px -20px rgba(37, 99, 235, 0.75);
}
.center-title {
  flex:1;
  min-width: 260px;
  text-align:center;
  font-weight:700;
  font-size:15px;
  color:var(--compose-text);
  display:flex;
  align-items:center;
  justify-content:center;
}
.work-area {
  flex:1;
  min-height:0;
  display:grid;
  grid-template-columns: 220px minmax(0, 1fr) 320px;
  gap:16px;
  overflow:hidden;
}
.side-left,
.side-right {
  min-height: 0;
  display:flex;
  flex-direction:column;
  padding:16px;
  border:1px solid var(--compose-border);
  border-radius:24px;
  background: var(--compose-surface);
  box-shadow: var(--compose-shadow);
  backdrop-filter: blur(18px);
}
.panel-title {
  font-size:13px;
  font-weight:700;
  color:var(--compose-text);
  margin-bottom:10px;
  line-height: 1.45;
}
.side-hint { font-size:11px; font-weight:500; color:var(--compose-text-muted); margin-left:4px; }
.object-list { list-style:none; margin:0; padding:0 4px 0 0; flex:1; overflow:auto; display:flex; flex-direction:column; gap:8px; }
.object-list li {
  font-size:12px;
  line-height: 1.45;
  padding:10px 12px;
  border-radius:14px;
  cursor:pointer;
  color:var(--compose-text-soft);
  background: rgba(255,255,255,0.58);
  border:1px solid transparent;
  transition: all .22s ease;
}
.object-list li:hover {
  transform: translateY(-1px);
  background: rgba(239,246,255,0.95);
  border-color: rgba(147,197,253,0.42);
}
.object-list li.act {
  background: linear-gradient(135deg, rgba(37,99,235,0.12), rgba(59,130,246,0.18));
  border-color: rgba(59,130,246,0.34);
  color: var(--compose-primary-strong);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
}
.placeholder { font-size:12px; color:var(--compose-text-muted); margin-top:10px; line-height:1.6; }
.placeholder p { margin:0 0 6px; }
.canvas-zone {
  min-height: 0;
  position:relative;
  display:flex;
  overflow:hidden;
  border:1px solid var(--compose-border);
  border-radius:28px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.12)),
    repeating-conic-gradient(#edf2f7 0% 25%, #e3eaf2 0% 50%) 50%/28px 28px;
  box-shadow: var(--compose-shadow);
}
.canvas-viewport {
  flex:1 1 auto;
  width:100%;
  min-width:0;
  min-height:0;
  display:flex;
  align-items:flex-start;
  justify-content:center;
  overflow:auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable both-edges;
  padding:24px;
}
.canvas-wrapper {
  flex: 0 0 auto;
  position:relative;
  width:max-content;
  padding:20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.95));
  border:1px solid rgba(203,213,225,0.92);
  border-radius:24px;
  box-shadow: var(--compose-shadow-strong);
}
.canvas-wrapper--manual-zoom {
  padding: 0;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
.side-switcher {
  display:flex;
  gap: var(--compose-gap);
  justify-content:center;
  align-items: stretch;
  padding:6px;
  background: rgba(15,23,42,0.05);
  border:1px solid rgba(148,163,184,0.22);
  border-radius:18px;
  backdrop-filter: blur(8px);
}
.side-btn {
  min-width:136px;
  height:var(--compose-control-h);
  padding-inline: 18px;
  font-size:14px;
  font-weight:600;
  border-radius:var(--compose-control-radius);
  transition: all 0.24s ease;
}
.side-switcher :deep(.el-button) {
  margin: 0;
  min-height: var(--compose-control-h);
  border-radius: var(--compose-control-radius);
  border-color: transparent;
  background: transparent;
  color: var(--compose-text-soft);
}
.side-switcher :deep(.el-button--primary) {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  box-shadow: 0 18px 28px -20px rgba(37,99,235,0.8);
}
.side-switcher :deep(.el-button:hover) {
  transform: translateY(-1px);
}

.view-actions {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.view-actions :deep(.el-button) {
  min-height: 38px;
  padding-inline: 12px;
  border-radius: 10px;
  font-weight: 600;
}
.zoom-stepper {
  display:flex;
  align-items:center;
  border:1px solid rgba(148,163,184,0.24);
  border-radius:12px;
  background: rgba(255,255,255,0.88);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
  overflow:hidden;
}
.zoom-stepper-btn {
  appearance:none;
  border:0;
  background:transparent;
  min-width:36px;
  height:38px;
  padding:0 10px;
  font-size:18px;
  font-weight:700;
  color:var(--compose-text-soft);
  cursor:pointer;
  transition: background .2s ease, color .2s ease;
}
.zoom-stepper-btn:hover {
  background: rgba(37,99,235,0.08);
  color: var(--compose-primary-strong);
}
.zoom-stepper-value {
  min-width:74px;
  padding:0 12px;
  font-size:12px;
  font-weight:700;
  line-height:38px;
  text-align:center;
  color:var(--compose-text-soft);
  border-inline:1px solid rgba(148,163,184,0.18);
  font-variant-numeric: tabular-nums;
}

.main-canvas {
  cursor:default;
  display:block;
  max-width:100%;
  height:auto;
  border-radius: 16px;
}
.main-canvas.dragging-merge { cursor:move; }

.prop-tabs { display:flex; flex-direction:column; flex:1; min-height:0; }
.prop-tabs :deep(.el-tabs__header){ margin:0; }
.prop-tabs :deep(.el-tabs__nav-wrap::after){ display:none; }
.prop-tabs :deep(.el-tabs__item){
  height: var(--compose-control-h);
  font-weight: 600;
  color: var(--compose-text-muted);
}
.prop-tabs :deep(.el-tabs__item.is-active){ color: var(--compose-primary-strong); }
.prop-tabs :deep(.el-tabs__active-bar){ background-color: var(--compose-primary); }
.prop-tabs :deep(.el-tabs__content){ flex:1; overflow:auto; }
.prop-tabs :deep(.el-tab-pane){ padding-inline: 4px; }
.prop-group { display:flex; flex-direction:column; gap:10px; padding:12px 8px 2px; }
.prop-group.small { gap:4px; }
.row2 { display:flex; flex-wrap:wrap; gap:8px; }
.color-row { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.slider-row :deep(.el-slider) {
  box-sizing: border-box;
  padding-inline: 10px;
}
.prop-group :deep(.el-button) {
  min-height: 36px;
  padding-inline: 14px;
  border-radius: 10px;
  font-weight: 600;
}
.prop-group :deep(.el-input__wrapper),
.prop-group :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 10px;
}
.kv { display:flex; justify-content:space-between; font-size:12px; padding:6px 0; color:var(--compose-text-soft); }
.empty-prop { padding:16px; font-size:12px; color:var(--compose-text-muted); }
.back-placeholder {
  margin-top: 16px;
  padding: 16px 18px;
  text-align: left;
  font-size: 13px;
  line-height: 1.6;
  color: var(--compose-text-muted);
  border: 1px solid rgba(248,113,113,0.28);
  border-radius: 14px;
  background: rgba(254,242,242,0.9);
}
.back-placeholder-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #b42318;
}
.hint {
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:14px;
  color:var(--compose-text-muted);
}
/* dialog grid */
.cover-dialog :deep(.el-dialog__body){ padding:12px 16px 18px; background:#1f252a; }
.cover-list-wrapper { display:flex; flex-direction:column; gap:10px; max-height:560px; }
.dialog-toolbar { display:flex; gap:8px; align-items:center; }
.search-input { width:220px; }
.cover-list-head { display:grid; grid-template-columns:1fr 100px 100px 90px; font-size:12px; padding:4px 10px; background:#2a3138; border:1px solid #394249; border-radius:6px; color:#aeb6bd; }
.cover-list { border:1px solid #31383f; border-radius:6px; overflow:auto; }
.cover-row { display:grid; grid-template-columns:1fr 100px 100px 90px; align-items:center; gap:0; padding:6px 10px; font-size:12px; cursor:pointer; border-bottom:1px solid #2d343b; }
.cover-row:last-child { border-bottom:none; }
.cover-row.sel { background:#344250; box-shadow:inset 0 0 0 1px #409eff; }
.cover-row:hover { background:#2c343c; }
.c-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#d0d5da; }
.c-id { color:#94a0aa; }
.mini-thumb { width:72px; height:96px; background:#e7ebef center/cover no-repeat; border:1px solid #ccd2d7; border-radius:4px; }
.mini-thumb.placeholder { background:#ffffff !important; border:1px solid #d5d9dd; }
.thumb-img { width:100%; height:100%; object-fit:contain; display:block; }
.preview-box { max-width:70vw; max-height:70vh; overflow:auto; }
.preview-large { max-width:100%; height:auto; display:block; border-radius:8px; }
/* PDF dialog */
.pdf-dialog :deep(.el-dialog__body){padding-top:10px;}
.pdf-toolbar{display:flex;align-items:center;gap:12px;margin:0 0 10px;}
.pdf-toolbar .auto-hint{font-size:12px;color:#9098a0;cursor:help;}
.pdf-toolbar .paper-info{font-size:12px;color:#c0c6cc;}
.pdf-preview-wrapper{display:flex;gap:20px;align-items:flex-start;justify-content:flex-start;flex-wrap:wrap;min-height:260px;}
.page-preview{border:1px solid #30363d;border-radius:8px;padding:8px;background:#1f2327;display:flex;flex-direction:column;gap:6px;}
.page-preview .tools{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#c7ccd2;margin-bottom:4px;}
.page-preview .img-box{position:relative;width:280px;max-height:380px;overflow:auto;background:#111;border:1px solid #2c3238;border-radius:4px;display:flex;align-items:center;justify-content:center;}
.page-preview img{max-width:100%;height:auto;transition:transform .25s;}
.angle-row { align-items:center; }
.main-canvas.brush-mode{ cursor:crosshair; }
.slider-row { display:flex; flex-direction:column; gap:4px; padding:4px 0; }
.slider-row > label { font-size:12px; color:var(--compose-text-muted); }
.field-row{display:flex;flex-direction:column;gap:4px;padding:4px 0;}
.field-label{font-size:12px;color:var(--compose-text-muted);}
.coord-inputs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.coord-item{display:flex;flex-direction:column;gap:4px;}
.coord-label{font-size:12px;color:var(--compose-text-soft);}
.export-dialog :deep(.el-dialog__header){background:#1f2327;color:#e2e6ea;padding:12px 16px;}
.export-dialog :deep(.el-dialog__body){background:#202529;padding:16px;}
.export-dialog :deep(.el-dialog__footer){background:#1f2327;border-top:1px solid #2d3237;padding:10px 16px;}
.export-options{display:flex;flex-direction:column;gap:12px;}
.exp-item{border:1px solid #2f353b;background:linear-gradient(135deg,#242a30,#1e2226);border-radius:8px;padding:12px 14px;}
.item-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.item-desc{font-size:12px;color:#9aa2ab;line-height:1.4;}
.item-config{background:rgba(0,0,0,0.2);border-radius:6px;padding:10px;margin-top:8px;display:flex;flex-direction:column;gap:8px;}
.config-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.config-row .label{font-size:12px;color:#9aa2ab;min-width:50px;}
.config-row .sep{color:#666;}
.config-row .unit{font-size:12px;color:#9aa2ab;}
.stroke-check{margin-right:4px;}
.export-dialog :deep(.el-input-number){width:80px;}

@media (prefers-color-scheme: dark) {
  .cover-compose-root {
    --compose-surface: linear-gradient(180deg, rgba(17,24,39,0.92), rgba(15,23,42,0.82));
    --compose-surface-strong: rgba(17,24,39,0.96);
    --compose-surface-soft: rgba(30,41,59,0.74);
    --compose-border: rgba(71,85,105,0.42);
    --compose-border-strong: rgba(100,116,139,0.46);
    --compose-text: #e5edf7;
    --compose-text-soft: #c4cfdb;
    --compose-text-muted: #94a3b8;
    --compose-shadow: 0 24px 48px -34px rgba(2,6,23,0.84);
    --compose-shadow-strong: 0 28px 56px -36px rgba(2,6,23,0.9);
  }

  .topbar :deep(.el-button--default) {
    background: rgba(15,23,42,0.7);
    color: var(--compose-text);
    border-color: rgba(71,85,105,0.5);
  }

  .object-list li {
    background: rgba(15,23,42,0.42);
  }

  .object-list li:hover {
    background: rgba(30,41,59,0.82);
    border-color: rgba(96,165,250,0.3);
  }

  .canvas-zone {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)),
      repeating-conic-gradient(#1f2937 0% 25%, #243040 0% 50%) 50%/28px 28px;
  }

  .canvas-wrapper {
    background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(17,24,39,0.92));
    border-color: rgba(71,85,105,0.6);
  }

  .canvas-wrapper--manual-zoom {
    background: transparent;
    border-color: transparent;
  }

  .stage-toolbar {
    background: rgba(15,23,42,0.68);
    border-color: rgba(71,85,105,0.42);
  }

  .side-switcher {
    background: rgba(255,255,255,0.04);
    border-color: rgba(71,85,105,0.44);
  }

  .zoom-stepper {
    background: rgba(15,23,42,0.84);
    border-color: rgba(71,85,105,0.52);
  }

  .zoom-stepper-btn {
    color: var(--compose-text-soft);
  }

  .zoom-stepper-btn:hover {
    background: rgba(59,130,246,0.14);
  }

  .zoom-stepper-value {
    border-inline-color: rgba(71,85,105,0.46);
  }
}

@media (max-width: 1480px) {
  .work-area {
    grid-template-columns: 200px minmax(0, 1fr) 300px;
  }
}

@media (max-width: 1220px) {
  .topbar {
    align-items: flex-start;
  }

  .stage-toolbar {
    align-items:flex-start;
  }

  .center-title {
    order: -1;
    width: 100%;
    min-width: 0;
    justify-content: flex-start;
    text-align: left;
  }

  .work-area {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .canvas-zone {
    order: 1;
    min-height: 520px;
  }

  .side-left,
  .side-right {
    order: 2;
  }
}

@media (max-width: 768px) {
  .select-overlay {
    padding: 72px 16px 24px;
  }

  .select-box {
    border-radius: 24px;
  }

  .select-box h2 {
    font-size: 21px;
  }

  .editor-layout {
    gap: 12px;
  }

  .topbar,
  .stage-toolbar,
  .side-left,
  .side-right,
  .canvas-zone {
    border-radius: 20px;
  }

  .topbar {
    padding: 12px 14px;
  }

  .stage-toolbar {
    padding: 10px 12px;
  }

  .canvas-viewport {
    padding: 16px;
  }

  .canvas-wrapper {
    padding: 14px;
    border-radius: 20px;
  }

  .canvas-wrapper--manual-zoom {
    padding: 0;
  }

  .side-switcher {
    flex-wrap: wrap;
  }

  .stage-toolbar-right {
    width:100%;
  }

  .view-actions {
    width: 100%;
    justify-content:flex-start;
  }

  .side-btn {
    min-width: 120px;
    width: calc(50% - 5px);
  }

  .zoom-stepper {
    flex: 1 1 160px;
  }
}

@media (max-width: 480px) {
  .select-overlay {
    padding-top: 60px;
  }

  .select-box {
    padding-inline: 22px;
    padding-block: 34px;
    border-radius: 22px;
  }

  .select-box h2 {
    font-size: 19px;
  }
}

</style>
