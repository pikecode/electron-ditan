<template>
  <div class="home-full">
    <div class="home-container">
      <div class="tiles">
        <button class="tile edit" type="button" @click="emitGo('go-edit')">
          <span class="icon">🎨</span>
          <span class="tile-copy">
            <span class="label">{{ $t('home.enterEdit') }}</span>
            <span class="desc">{{ $t('home.enterEditDesc') }}</span>
          </span>
        </button>
        <button class="tile merge" type="button" @click="emitGo('go-merge')">
          <span class="icon">🧩</span>
          <span class="tile-copy">
            <span class="label">{{ $t('home.enterMerge') }}</span>
            <span class="desc">{{ $t('home.enterMergeDesc') }}</span>
          </span>
        </button>
        <button class="tile photopea" type="button" @click="emitGo('go-photopea')">
          <span class="icon ps-icon">
            <span>Ps</span>
          </span>
          <span class="tile-copy">
            <span class="label">{{ $t('home.enterPhotopea') }}</span>
            <span class="desc">{{ $t('home.enterPhotopeaDesc') }}</span>
          </span>
          <span class="open-mark">›</span>
        </button>
      </div>
      <footer class="meta-footer">
        <div class="meta-line">
          <span class="app-name">EasyStitch</span>
          <span class="dot" />
          <span class="version">v{{ version }}</span>
          <span class="dot" />
          <button v-if="!showEmail" class="email-toggle" @click="revealEmail" :aria-label="$t('home.emailAria')">📧</button>
          <transition name="fade-email">
            <a v-if="showEmail" class="dev-mail" :href="'mailto:' + developerEmail" @click.stop="openMail">{{ developerEmail }}</a>
          </transition>
        </div>
        <div class="meta-line second">
          <span>{{ $t('home.copyright', { year }) }}</span>
          <span class="dot" />
          <button class="legal-link" @click="showLegal = true">{{ $t('home.legalLink') }}</button>
        </div>
      </footer>
    </div>

    <el-dialog v-model="showLegal" width="680px" :close-on-click-modal="false" class="legal-dialog">
      <template #header>
        <span>{{ $t('home.legalDialogTitle') }}</span>
      </template>
      <div class="legal-body">
        <p class="legal-title">{{ $t('home.legalOriginal') }}</p>
        <p class="legal-text">{{ $t('home.legalP1') }}</p>
        <p class="legal-text">{{ $t('home.legalP2') }}</p>
        <div class="legal-meta">{{ $t('home.legalMeta', { year }) }}</div>
      </div>
      <template #footer>
        <el-button @click="showLegal = false">{{ $t('home.legalClose') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script>
import pkg from '../../package.json'
export default {
  name:'HomeView',
  emits:['go-edit','go-merge','go-photopea'],
  data(){ return { version: pkg.version || '1.0.1', developerEmail:'shuosi0909@163.com', year: new Date().getFullYear(), showEmail:false, showLegal:false } },
  methods:{
    emitGo(eventName) {
      console.log('[HomeView] emit', eventName)
      this.$emit(eventName)
    },
    revealEmail(){ this.showEmail = true },
    openMail(e){ /* optional: could add copy feedback */ }
  }
}
</script>
<style scoped>
.home-full {width:100%; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:clamp(28px,6vh,72px) 40px 28px; box-sizing:border-box; background:linear-gradient(160deg,#f5f5f7 0%,#ffffff 70%); overflow:auto;}
.home-container {width:100%; max-width:1200px; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:clamp(24px,5vh,56px);}
.home-header {margin:0; width:100%; text-align:center;}
.title {margin:0 0 12px; font-size:48px; font-weight:700; letter-spacing:1px; color:#111; width:100%; text-align:center;}
.subtitle {margin:0; font-size:18px; font-weight:500; color:#555; width:100%; text-align:center;}
.tiles {display:grid; grid-template-columns:repeat(3,minmax(260px,340px)); gap:28px; align-items:stretch; justify-content:center; width:100%;}
.tile {--clr:#007aff; position:relative; border:1px solid rgba(0,0,0,0.06); background:linear-gradient(145deg,#ffffff,#f3f3f7); padding:clamp(22px,3.2vh,30px) 28px clamp(24px,3.5vh,32px); border-radius:24px; text-align:left; display:flex; flex-direction:column; gap:clamp(12px,2vh,18px); cursor:pointer; box-shadow:0 18px 46px -22px rgba(0,0,0,0.24),0 8px 20px -12px rgba(0,0,0,0.14); transition:transform .28s ease, box-shadow .28s ease, border-color .28s ease; font-family:inherit; overflow:hidden; min-height:clamp(156px,24vh,206px);}
.tile.merge {--clr:#34c759;}
.tile.photopea {--clr:#2487ff; background:linear-gradient(145deg,#14213a,#0d1117); border-color:rgba(117,179,255,.28); color:#f6f8fb;}
.tile::before {content:''; position:absolute; inset:0; background:radial-gradient(circle at 26% 24%,var(--clr) 0%,transparent 65%); opacity:.12; transition:opacity .5s;}
.tile.photopea::before {opacity:.28;}
.tile .icon {position:relative; z-index:1; width:64px; height:64px; display:flex; align-items:center; justify-content:center; font-size:48px; line-height:1; filter:drop-shadow(0 6px 10px rgba(0,0,0,0.18));}
.tile .ps-icon {border-radius:14px; background:#001e36; border:2px solid #31a8ff; color:#31a8ff; font-family:Arial,sans-serif; font-size:24px; font-weight:800; letter-spacing:0;}
.tile-copy {position:relative; z-index:1; display:flex; flex-direction:column; gap:8px; min-width:0;}
.tile .label {font-size:28px; font-weight:800; letter-spacing:0; color:#141414;}
.tile.photopea .label {color:#fff;}
.tile .desc {font-size:15px; letter-spacing:.4px; font-weight:500; color:#5d5d63;}
.tile.photopea .desc {color:#b8c7d9;}
.open-mark {position:absolute; right:24px; bottom:22px; z-index:1; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(49,168,255,.18); color:#8ed0ff; font-size:28px; line-height:1;}
.tile:hover {transform:translateY(-8px) scale(1.02); box-shadow:0 30px 60px -22px rgba(0,0,0,0.30),0 16px 34px -14px rgba(0,0,0,0.18);}
.tile:hover::before {opacity:.22;}
.tile.photopea:hover {border-color:rgba(49,168,255,.75); box-shadow:0 30px 70px -24px rgba(21,69,129,.56),0 16px 34px -16px rgba(0,0,0,.38);}
.tile.photopea:hover::before {opacity:.36;}
.tile:active {transform:translateY(-2px) scale(.97); transition:transform .15s;}
@media (max-width:1100px){ .tiles{grid-template-columns:repeat(2,minmax(260px,340px)); gap:24px;} .tile.photopea{grid-column:1 / -1; min-height:clamp(140px,22vh,170px);} }
@media (max-width:600px){ .home-full {align-items:flex-start; padding:64px 20px 24px;} .home-container{gap:28px;} .title{font-size:36px;} .tiles{grid-template-columns:1fr; width:100%;} .tile,.tile.photopea{grid-column:auto; min-height:144px; padding:22px 24px 26px;} .tile .label{font-size:24px;} .tile .icon{width:54px;height:54px;font-size:40px;} .tile .ps-icon{font-size:21px;} }
@media (max-height:700px) and (min-width:900px){ .home-full{align-items:flex-start; padding-top:56px;} .home-container{gap:22px;} .tile{min-height:150px;} .tile .icon{width:52px;height:52px;font-size:38px;} .tile .ps-icon{font-size:21px;} .tile .label{font-size:24px;} .meta-footer{margin-top:0;} }
.meta-footer {width:100%; display:flex; flex-direction:column; gap:4px; align-items:center; font-size:12px; color:#666; padding-top:8px; margin-top:8px;}
.meta-line {display:flex; align-items:center; gap:10px; font-weight:500; letter-spacing:.4px; flex-wrap:wrap; justify-content:center;}
.meta-line.second {font-weight:400; opacity:.6; font-size:11px;}
.app-name {font-weight:600; color:#222;}
.version {font-family:SFMono-Regular,Menlo,monospace; background:#f0f1f4; padding:2px 8px; border-radius:12px; font-size:11px; color:#333; box-shadow:0 1px 2px rgba(0,0,0,0.08) inset;}
.dev-mail {text-decoration:none; color:#007aff; font-weight:600; transition:color .25s;}
.dev-mail:hover {color:#005fcc; text-decoration:underline;}
.dot {width:4px; height:4px; border-radius:50%; background:#c9c9ce; display:inline-block;}
.email-toggle {background:#e9ecf1; border:none; width:28px; height:28px; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; line-height:1; padding:0; box-shadow:0 1px 2px rgba(0,0,0,0.15) inset,0 1px 2px rgba(0,0,0,0.06); transition:background .25s, transform .25s;} 
.email-toggle:hover {background:#dfe3e9;} 
.email-toggle:active {transform:scale(.9);} 
.fade-email-enter-active,.fade-email-leave-active {transition:opacity .25s ease;} 
.fade-email-enter-from,.fade-email-leave-to {opacity:0;} 

.legal-link {background:transparent; border:none; padding:2px 6px; border-radius:10px; cursor:pointer; color:#007aff; font-weight:600; font-size:11px; letter-spacing:.2px;}
.legal-link:hover {text-decoration:underline;}
.legal-dialog :deep(.el-dialog__body){ padding: 16px 18px 14px; }
.legal-body{ display:flex; flex-direction:column; gap:10px; }
.legal-title{ margin:0; font-size:18px; font-weight:800; color:#111; letter-spacing:.6px; }
.legal-text{ margin:0; font-size:13px; line-height:1.65; color:#333; }
.legal-meta{ margin-top:4px; font-size:12px; color:#6b7280; }
</style>
