<template>
  <div class="home-full">
    <div class="home-container">
      <div class="tiles">
        <button class="tile edit" @click="$emit('go-edit')">
          <span class="icon">🎨</span>
          <span class="label">{{ $t('home.enterEdit') }}</span>
          <span class="desc">{{ $t('home.enterEditDesc') }}</span>
        </button>
        <button class="tile merge" @click="$emit('go-merge')">
          <span class="icon">🧩</span>
          <span class="label">{{ $t('home.enterMerge') }}</span>
          <span class="desc">{{ $t('home.enterMergeDesc') }}</span>
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
  emits:['go-edit','go-merge'],
  data(){ return { version: pkg.version || '1.0.1', developerEmail:'shuosi0909@163.com', year: new Date().getFullYear(), showEmail:false, showLegal:false } },
  methods:{
    revealEmail(){ this.showEmail = true },
    openMail(e){ /* optional: could add copy feedback */ }
  }
}
</script>
<style scoped>
.home-full {width:100%; height:100vh; display:flex; align-items:center; justify-content:center; padding:0 40px; box-sizing:border-box; background:linear-gradient(160deg,#f5f5f7 0%,#ffffff 70%);} 
.home-container {width:100%; max-width:1200px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:56px;}
.home-header {margin:0; width:100%; text-align:center;}
.title {margin:0 0 12px; font-size:48px; font-weight:700; letter-spacing:1px; color:#111; width:100%; text-align:center;}
.subtitle {margin:0; font-size:18px; font-weight:500; color:#555; width:100%; text-align:center;}
.tiles {display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,360px)); gap:46px; align-items:start; justify-content:center;}
.tile {--clr:#007aff; position:relative; border:none; background:linear-gradient(145deg,#ffffff,#f3f3f7); padding:38px 40px 44px; border-radius:40px; text-align:left; display:flex; flex-direction:column; gap:14px; cursor:pointer; box-shadow:0 18px 46px -18px rgba(0,0,0,0.20),0 8px 20px -8px rgba(0,0,0,0.12); transition:transform .55s cubic-bezier(.34,1.56,.64,1), box-shadow .4s, background .5s; font-family:inherit; overflow:hidden; min-height:220px;}
.tile.merge {--clr:#34c759;}
.tile::before {content:''; position:absolute; inset:0; background:radial-gradient(circle at 26% 24%,var(--clr) 0%,transparent 65%); opacity:.12; transition:opacity .5s;}
.tile .icon {font-size:56px; line-height:1; filter:drop-shadow(0 6px 10px rgba(0,0,0,0.18));}
.tile .label {font-size:30px; font-weight:700; letter-spacing:.6px; color:#141414;}
.tile .desc {font-size:15px; letter-spacing:.4px; font-weight:500; color:#5d5d63;}
.tile:hover {transform:translateY(-12px) scale(1.035); box-shadow:0 30px 60px -22px rgba(0,0,0,0.30),0 16px 34px -14px rgba(0,0,0,0.18);} 
.tile:hover::before {opacity:.22;}
.tile:active {transform:translateY(-2px) scale(.97); transition:transform .15s;}
@media (max-width:900px){ .home-container {gap:48px;} .title{font-size:42px;} .tiles{gap:38px;} }
@media (max-width:600px){ .home-full {padding:0 24px;} .home-container{gap:40px;} .title{font-size:36px;} .tiles{grid-template-columns:1fr;} .tile{min-height:200px; padding:34px 34px 40px;} }
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
