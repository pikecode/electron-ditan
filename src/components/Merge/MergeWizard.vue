<template>
  <div class="merge-wizard-ios">
    <div class="progress-shell">
      <ProgressRail 
        :current-step="step" 
        :total-steps="4" 
        @step-change="handleStepChange" 
      />
    </div>
    
    <div class="cards-area">
      <transition name="fade-slide" mode="out-in">
        <ZipImportStep 
          v-if="step === 1" 
          :key="1"
          @next-step="handleNextStep" 
        />
        
        <TemplateSelectStep 
          v-else-if="step === 2" 
          :key="2"
          @next-step="handleNextStep"
          @prev-step="handlePrevStep" 
        />
        
        
        <BrushifyMergeStep 
          v-else-if="step === 3"
          :key="3"
          @prev-step="handlePrevStep"
        />
        <CoverComposeStep
          v-else-if="step === 4"
          :key="4"
        />
      </transition>
    </div>
  </div>
</template>

<script setup>
import { useMergeStore } from '../../composables/useMergeStore.js'
import ProgressRail from './ProgressRail.vue'
import ZipImportStep from './ZipImportStep.vue'
import TemplateSelectStep from './TemplateSelectStep.vue'
import BrushifyMergeStep from './BrushifyMergeStep.vue'
import CoverComposeStep from './CoverComposeStep.vue'

const mergeStore = useMergeStore()
const { step, goStep } = mergeStore

function handleStepChange(targetStep) {
  if (targetStep <= step.value || targetStep === step.value + 1) {
    goStep(targetStep)
  }
}
function handleNextStep() { if (step.value < 4) goStep(step.value + 1) }
function handlePrevStep() { if (step.value > 1) goStep(step.value - 1) }
</script>

<style scoped>
.merge-wizard-ios {
  position: relative;
  padding: 18px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 28%),
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.1), transparent 24%),
    linear-gradient(180deg, #f4f7fb 0%, #eef3f9 52%, #e7edf5 100%);
  overflow: hidden;
}

.progress-shell {
  position: relative;
  z-index: 2;
}

.cards-area {
  position: relative;
  flex: 1;
  min-height: 0;
  isolation: isolate;
}

.cards-area::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 32px;
  background: linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.08));
  pointer-events: none;
  z-index: -1;
}


.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0.14, 0.3, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-18px) scale(0.98);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .merge-wizard-ios {
    background:
      radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 30%),
      radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 24%),
      linear-gradient(180deg, #111827 0%, #172033 55%, #1f2937 100%);
  }

  .cards-area::before {
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0));
  }
}


@media (max-width: 768px) {
  .merge-wizard-ios {
    padding: 12px 12px 18px;
    gap: 14px;
  }
}

@media (max-width: 480px) {
  .merge-wizard-ios {
    padding: 10px 8px 14px;
    gap: 12px;
  }
}
</style>
