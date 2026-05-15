<template>
  <el-config-provider :locale="elementLocale">
    <div :class="['app-root', { 'full-mode': mode !== 'home', 'mode-edit': mode==='edit', 'mode-merge': mode==='merge' }]">
      <HomeView
        v-if="mode==='home'"
        @go-edit="enter('edit')"
        @go-merge="enter('merge')"
        @go-photopea="enter('photopea')"
      />
      <EditCanvas v-else-if="mode==='edit'" @go-home="backHome" />
      <MergeCanvas v-else-if="mode==='merge'" @go-home="backHome" />
      <button v-if="mode!=='home'" class="back-btn" @click="backHome" :aria-label="$t('appShell.backHomeAria')">
        〈 {{ $t('appShell.backHome') }}
      </button>
    </div>
    
    <Teleport to="body">
      <div class="global-lang-host" role="navigation" :aria-label="$t('appShell.languageHint')">
        <LanguageSwitcher :compact="mode !== 'home'" />
      </div>
    </Teleport>
  </el-config-provider>
</template>

<script>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElConfigProvider, ElMessageBox } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import EditCanvas from './components/EditCanvas.vue'
import MergeCanvas from './components/MergeCanvas.vue'
import HomeView from './components/HomeView.vue'
import LanguageSwitcher from "./components/LanguageSwitcher.vue"
import { useMergeStore } from './composables/useMergeStore.js'

function getIpcRenderer() {
  try {
    if (typeof window !== 'undefined' && window?.electron?.ipcRenderer) {
      return window.electron.ipcRenderer
    }
    if (typeof require === 'function') {
      const { ipcRenderer } = require('electron')
      return ipcRenderer
    }
  } catch (_) {}
  return null
}

export default {
  name: 'AppLauncher',
  components:{ HomeView, EditCanvas, MergeCanvas, LanguageSwitcher, ElConfigProvider },
  setup() {
    const { locale } = useI18n()
    const elementLocale = computed(() => (locale.value === 'zh' ? zhCn : en))
    const { resetMergeState } = useMergeStore()
    return { elementLocale, resetMergeState }
  },
  data(){ return { mode:'home' } },
  methods:{
    async enter(type){
      if (type === 'photopea') {
        await this.openPhotopeaWindow()
        return
      }
      if (type === 'merge') this.resetMergeState()
      console.log('[App] enter', type)
      this.mode = type
    },
    async openPhotopeaWindow(){
      try {
        const ipcRenderer = getIpcRenderer()
        if (!ipcRenderer) throw new Error('electron-ipc-unavailable')
        const result = await ipcRenderer.invoke('photopea:open-workbench-window')
        if (!result?.ok) {
          const detail = result?.setupHint ? `\n\n${result.setupHint}` : ''
          throw new Error(`${result?.error || 'photopea-workbench-open-failed'}${detail}`)
        }
      } catch (error) {
        await ElMessageBox.alert(
          error?.message || String(error),
          this.$t('photopeaWorkbench.missingTitle'),
          {
            confirmButtonText: this.$t('photopeaWorkbench.retry'),
            type: 'error'
          }
        )
      }
    },
    async backHome(){
      if (this.mode === 'merge') {
        try {
          await ElMessageBox.confirm(
            this.$t('merge.exitConfirm.message'),
            this.$t('merge.exitConfirm.title'),
            {
              type: 'warning',
              confirmButtonText: this.$t('merge.exitConfirm.confirm'),
              cancelButtonText: this.$t('merge.exitConfirm.cancel'),
              closeOnClickModal: false
            }
          )
        } catch (_) {
          return
        }
        this.resetMergeState()
      }
      console.log('[App] back home')
      this.mode='home'
    }
  },
  mounted(){ console.log('[App] mounted, init mode=home') }
}
</script>

<style scoped>
.app-root {height:100vh; min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC',sans-serif; background:linear-gradient(160deg,#f5f5f7 0%,#ffffff 100%); position:relative; overflow:hidden;}
.full-mode {background:#fff;}
.fade-enter-active,.fade-leave-active {transition:opacity .25s ease, transform .25s ease;}
.fade-enter-from,.fade-leave-to {opacity:0; transform:translateY(6px);} 
.home-screen {display:flex; align-items:center; justify-content:center; padding:60px 40px;}
.hero-card {width:100%; max-width:1000px; background:rgba(255,255,255,0.82); backdrop-filter:saturate(180%) blur(30px); border-radius:40px; padding:56px 64px; box-shadow:0 30px 60px -18px rgba(0,0,0,0.12),0 18px 36px -12px rgba(0,0,0,0.08); display:flex; flex-direction:column; gap:42px;}
.hero-title {margin:0; font-size:48px; font-weight:700; background:linear-gradient(90deg,#111,#3a3a3c); -webkit-background-clip:text; background-clip:text; color:transparent; letter-spacing:1px;}
.hero-sub {margin:0; font-size:18px; color:#555; font-weight:500;}
.segmented {display:inline-flex; background:#ebebef; border-radius:18px; padding:4px; gap:4px; box-shadow:inset 0 0 0 1px #d0d0d4;}
.seg-btn {position:relative; z-index:1; cursor:pointer; border:none; background:transparent; font-size:15px; font-weight:600; padding:10px 24px; border-radius:14px; color:#555; transition:all .25s; letter-spacing:.5px;}
.seg-btn.active {background:#fff; color:#007aff; box-shadow:0 2px 8px rgba(0,0,0,0.08);} 
.seg-btn:not(.active):hover {color:#111;}
.quick-actions {display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:28px;}
.action-tile {--clr:#007aff; position:relative; border:none; text-align:left; padding:26px 26px 30px; border-radius:34px; background:linear-gradient(145deg,#ffffff,#f2f2f7); box-shadow:0 10px 30px -12px rgba(0,0,0,0.15),0 2px 6px rgba(0,0,0,0.08); cursor:pointer; display:flex; flex-direction:column; gap:8px; transition:transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .25s; overflow:hidden;}
.action-tile.edit {--clr:#007aff;}
.action-tile.merge {--clr:#34c759;}
.action-tile::before {content:''; position:absolute; inset:0; background:radial-gradient(circle at 30% 20%,var(--clr) 0%,transparent 65%); opacity:.10; transition:opacity .35s;}
.action-tile .icon {font-size:42px; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.15));}
.action-tile .label {font-size:22px; font-weight:700; color:#111;}
.action-tile .desc {font-size:13px; letter-spacing:.5px; font-weight:500; color:#666;}
.action-tile:hover {transform:translateY(-6px) scale(1.02); box-shadow:0 16px 40px -18px rgba(0,0,0,0.25),0 6px 14px rgba(0,0,0,0.15);} 
.action-tile:hover::before {opacity:.18;}
.back-btn {position:fixed; top:12px; left:72px; height:32px; padding:0 12px 0 16px; border:none; border-radius:16px; background:rgba(255,255,255,0.82); -webkit-backdrop-filter:blur(18px) saturate(180%); backdrop-filter:blur(18px) saturate(180%); box-shadow:0 2px 8px rgba(0,0,0,0.16); font-size:14px; font-weight:600; color:#007aff; display:flex; align-items:center; gap:2px; cursor:pointer; letter-spacing:.4px; transition:background .25s, box-shadow .25s, transform .18s; z-index:1000;}
.back-btn:hover {background:rgba(255,255,255,0.95); box-shadow:0 4px 12px rgba(0,0,0,0.20);} 
.back-btn:active {transform:scale(.94);} 


.global-lang-host {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 2147483646;
  pointer-events: auto;
}
@media (max-width: 520px) {
  .global-lang-host { top: 10px; right: 12px; }
}
@media (prefers-color-scheme: dark) {
  .global-lang-host :deep(.language-switcher .current-language) {
    background: rgba(46, 48, 50, 0.88);
    color: #7dc4ff;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
  .global-lang-host :deep(.language-switcher .current-language:hover) {
    background: rgba(55, 58, 60, 0.95);
  }
  .global-lang-host :deep(.language-switcher .language-code),
  .global-lang-host :deep(.language-switcher .dropdown-arrow) {
    color: #7dc4ff;
  }
}
@media (max-width:900px){
  .hero-card {padding:48px 40px; gap:36px;}
  .hero-title {font-size:40px;}
  .quick-actions {grid-template-columns:1fr;}
}
</style>
