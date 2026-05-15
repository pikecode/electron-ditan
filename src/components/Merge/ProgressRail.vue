<template>
  <div class="progress-rail-compact" role="progressbar" :aria-valuemin="1" :aria-valuemax="totalSteps" :aria-valuenow="currentStep">
    <div class="track">
      <div class="track-fill" :style="{ width: fillPercent }"></div>
      <div
        v-for="n in totalSteps"
        :key="n"
        class="step-wrapper"
        :style="{ left: positionPercent(n) }"
      >
        <button
          type="button"
            class="step-dot"
            :class="{ active: currentStep === n, done: currentStep > n }"
            :aria-current="currentStep === n ? 'step' : undefined"
            @click="$emit('step-change', n)"
        >
          <span class="ring" aria-hidden="true"></span>
          <span class="dot-label">{{ n }}</span>
        </button>
      </div>
    </div>
    <div class="labels" aria-hidden="true">
      <div
        v-for="n in totalSteps"
        :key="'lbl'+n"
        class="label"
        :class="{ active: currentStep === n, done: currentStep > n }"
        :style="{ left: positionPercent(n) }"
      >{{ t('merge.progressStep', { n }) }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  currentStep: { type: Number, required: true, default: 1 },
  totalSteps: { type: Number, default: 3 }
})

defineEmits(['step-change'])

const fillPercent = computed(() => {
  if (props.totalSteps <= 1) return '100%'
  const step = Math.min(props.totalSteps, Math.max(1, props.currentStep))
  return (((step - 1) / (props.totalSteps - 1)) * 100) + '%'
})
function positionPercent(n){
  if(props.totalSteps<=1) return '0%'
  return ((n-1)/(props.totalSteps-1))*100 + '%'
}
</script>

<style scoped>
.progress-rail-compact {
  position: relative;
  padding: 18px 18px 16px;
  margin: 0;
  min-height: 96px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.88)),
    radial-gradient(circle at top left, rgba(96,165,250,0.12), transparent 32%);
  box-shadow:
    0 22px 44px -34px rgba(15, 23, 42, 0.34),
    inset 0 1px 0 rgba(255,255,255,0.78);
  isolation: isolate;
  overflow: visible;
  --dot-size: 20px;
  --dot-active: 28px;
  --track-h: 6px;
  --clr-fill-a: #22c55e;
  --clr-fill-b: #2563eb;
  --clr-bg: rgba(148, 163, 184, 0.18);
  --clr-node: rgba(255,255,255,0.98);
  --clr-node-border: rgba(37, 99, 235, 0.18);
  --clr-text: #1f2937;
  --clr-done: #34c759;
  -webkit-user-select: none; user-select: none;
}

.progress-rail-compact::after {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0));
  pointer-events: none;
  z-index: -1;
}

.track { position: relative; height: 34px; margin: 0 34px; }
.track::before { content:""; position:absolute; inset: calc(50% - var(--track-h) / 2) 0 auto; height: var(--track-h); background: var(--clr-bg); border-radius: 999px; backdrop-filter: blur(8px); }
.track-fill { position:absolute; inset: calc(50% - var(--track-h) / 2) auto auto 0; height: var(--track-h); background: linear-gradient(90deg,var(--clr-fill-a),var(--clr-fill-b)); border-radius:999px; width:0; transition: width .45s cubic-bezier(.4,.14,.3,1); box-shadow:0 0 0 1px rgba(255,255,255,0.35), 0 0 14px -3px rgba(37,99,235,0.45); }

.step-wrapper { position:absolute; top:50%; transform:translate(-50%, -50%); z-index: 1; }
.step-dot { position:relative; width:var(--dot-size); height:var(--dot-size); border:none; padding:0; background:var(--clr-node); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font:600 11px/1 "SF Pro Display","Segoe UI","PingFang SC",sans-serif; color:var(--clr-text); box-shadow:0 10px 20px -16px rgba(15,23,42,0.9); border:1px solid var(--clr-node-border); transition: all .28s cubic-bezier(.4,.2,.3,1); }
.step-dot .ring { position:absolute; inset: -5px; border-radius:50%; border:2px solid transparent; transition:inherit; }
.step-dot:hover { transform:translateY(-2px); }
.step-dot:focus-visible { outline:2px solid #409eff; outline-offset:2px; }
.step-dot.active { width:var(--dot-active); height:var(--dot-active); background:linear-gradient(145deg,#3b82f6,#2563eb); color:#fff; border-color:rgba(255,255,255,0.7); box-shadow:0 16px 28px -16px rgba(37,99,235,0.82); }
.step-dot.active .ring { border-color: rgba(59,130,246,0.42); box-shadow:0 0 0 4px rgba(37,99,235,0.14); }
.step-dot.done { background:linear-gradient(145deg,var(--clr-done),#1b9f46); color:#fff; border-color:rgba(255,255,255,0.45); }
.step-dot.done .ring { border-color:rgba(52,199,89,0.45); }

.labels { position:relative; margin: 14px 34px 0; height:20px; }
.label { position:absolute; transform:translateX(-50%); font:600 11px/1.2 "SF Pro Text","Segoe UI","PingFang SC",sans-serif; letter-spacing:.02em; color:#64748b; opacity:.72; transition: all .35s; white-space:nowrap; }
.label.active { color:#0f172a; opacity:1; font-weight:700; }
.label.done { color:#2e7d43; opacity:.95; }

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .progress-rail-compact {
    background:
      linear-gradient(180deg, rgba(19,24,31,0.94), rgba(17,24,39,0.88)),
      radial-gradient(circle at top left, rgba(37,99,235,0.18), transparent 30%);
    border-color: rgba(71, 85, 105, 0.4);
    box-shadow:
      0 28px 52px -34px rgba(2, 6, 23, 0.8),
      inset 0 1px 0 rgba(255,255,255,0.04);
    --clr-bg: rgba(148,163,184,0.18);
    --clr-node: rgba(30,41,59,0.96);
    --clr-node-border: rgba(96,165,250,0.2);
    --clr-text:#d5dae0;
  }
  .progress-rail-compact::after { background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0)); }
  .label { color:#94a3b8; }
  .label.active { color:#ffffff; }
  .label.done { color:#69d98f; }
  .step-dot { box-shadow:0 2px 6px rgba(0,0,0,0.45); }
  .step-dot.active { box-shadow:0 4px 14px -2px rgba(64,158,255,0.7); }
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) { .track-fill, .step-dot, .label { transition: none; } }

@media (max-width: 768px) {
  .progress-rail-compact {
    min-height: 84px;
    padding: 16px 12px 14px;
  }

  .track,
  .labels {
    margin-left: 22px;
    margin-right: 22px;
  }

  .label {
    font-size: 10px;
  }
}
</style>
