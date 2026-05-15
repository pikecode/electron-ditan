<template>
  <el-container class="merge-layout">
    <el-aside width="180px" class="merge-aside">
      <div class="aside-header"></div>
      <div class="aside-buttons">
        <!-- Custom nav buttons (Plan A) -->
        <button class="nav-btn" :class="{ active: currentView==='merge' }" @click="switchView('merge')">{{ t('merge.navMerge') }}</button>
        <button class="nav-btn" :class="{ active: currentView==='templates' }" @click="switchView('templates')">{{ t('merge.navTemplates') }}</button>
        <button class="nav-btn" :class="{ active: currentView==='covers' }" @click="switchView('covers')">{{ t('merge.navCovers') }}</button>
      </div>
    </el-aside>
    <el-container>
      <el-main class="merge-main">
        <Merge v-if="currentView==='merge'" />
        <TemplateManager v-else-if="currentView==='templates'" ref="tplMgr" />
        <CoverManager v-else ref="coverMgr" />
      </el-main>
    </el-container>
  </el-container>
</template>
<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import TemplateManager from './merge/TemplateManager.vue'
import Merge from './merge/Merge.vue'
import CoverManager from './cover/CoverManager.vue'

const tplMgr = ref(null)
const coverMgr = ref(null)
const currentView = ref('merge')
function switchView(v){
  currentView.value = v
  if(v==='templates') tplMgr.value?.refresh?.()
  if(v==='covers') coverMgr.value?.refresh?.()
}
function refreshTemplates(){ if(currentView.value==='templates') tplMgr.value?.refresh?.() }
</script>
<style scoped>
.merge-layout { height:100vh; background:#f8f8f9; }
.merge-aside { background:rgba(255,255,255,0.72); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px); border-right:1px solid rgba(0,0,0,0.08); display:flex; flex-direction:column; padding:28px 18px 32px; gap:28px; }
.aside-header { font-size:0; padding:0; height:8px; }
.aside-buttons { margin-top:0; display:flex; flex-direction:column; gap:16px; width:100%; }
/* Plan A: unified custom nav buttons */
.nav-btn { -webkit-appearance:none; appearance:none; border:1px solid rgba(0,0,0,0.1); background:rgba(255,255,255,0.55); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px); border-radius:24px; height:46px; width:100%; padding:0 18px; font-size:15px; font-weight:500; letter-spacing:.4px; display:flex; align-items:center; justify-content:center; color:#1f2530; cursor:pointer; line-height:1; box-shadow:0 3px 8px rgba(0,0,0,0.08); transition:background .25s, box-shadow .25s, transform .22s; }
.nav-btn:hover { background:rgba(255,255,255,0.78); }
.nav-btn:active { transform:translateY(1px); }
.nav-btn.active { background:linear-gradient(165deg,#409eff,#2a7edb); color:#fff; border:1px solid #2a84e8; box-shadow:0 6px 14px rgba(64,158,255,0.35); }
.nav-btn.active:hover { filter:brightness(1.05); }
.nav-btn:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(64,158,255,0.35); }
.merge-header { background:rgba(255,255,255,0.85); backdrop-filter:saturate(180%) blur(18px); -webkit-backdrop-filter:saturate(180%) blur(18px); border-bottom:1px solid rgba(0,0,0,0.06); display:flex; align-items:center; padding:0 20px; }
.merge-header h2 { margin:0; font-size:18px; font-weight:600; letter-spacing:.5px; }
.merge-main { background:linear-gradient(180deg,#f9f9fb,#f3f4f7); padding:12px 16px 24px; overflow:auto; }
@media (prefers-color-scheme: dark){
  .merge-layout { background:#111315; }
  .merge-aside { background:rgba(34,36,38,0.6); border-right:1px solid rgba(255,255,255,0.08); }
  .merge-header { background:rgba(34,36,38,0.55); border-bottom:1px solid rgba(255,255,255,0.08); }
  .merge-main { background:linear-gradient(180deg,#1a1c1e,#16181a); }
  .aside-header, .merge-header h2 { color:#f5f5f7; }
  .nav-btn { color:#e6e9ec; border:1px solid rgba(255,255,255,0.08); background:rgba(55,57,59,0.55); box-shadow:0 3px 10px rgba(0,0,0,0.35); }
  .nav-btn:hover { background:rgba(60,62,64,0.72); }
  .nav-btn.active { background:linear-gradient(165deg,#3d8fe8,#1e66b5); border:1px solid #2a84e8; }
}
</style>
