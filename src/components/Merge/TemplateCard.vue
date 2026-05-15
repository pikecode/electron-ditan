<template>
  <div class="template-card" :class="typeClass">
    <div class="thumb" :style="!preview ? templateThumbStyle : null">
      <img v-if="preview" :src="preview" :alt="t('merge.templateCard.previewAlt')" />
    </div>
    
    <div class="meta">
      <div class="name" :title="template.name">{{ template.name }}</div>
      <div class="line">{{ description }}</div>
      <div v-if="sizeDiff" class="line diff">
        {{ t('merge.templateCard.diffVsGrid', { dw: sizeDiff.w, dh: sizeDiff.h }) }}
      </div>
      <div v-if="originalSize" class="line from">
        {{ t('merge.templateCard.origSize', { w: originalSize.width, h: originalSize.height }) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  template: {
    type: Object,
    required: true
  },
  preview: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'exact', 'nearest', 'resized'].includes(value)
  },
  description: {
    type: String,
    default: ''
  },
  sizeDiff: {
    type: Object,
    default: null
  },
  originalSize: {
    type: Object,
    default: null
  }
})

const typeClass = computed(() => `template-card--${props.type}`)

const templateThumbStyle = computed(() => {
  if (!props.template) return { background: '#ddd' }
  
  const id = (props.template.id || props.template.name || '') + ''
  let hash = 0
  
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0
  }
  
  const c1 = '#' + ((hash >>> 8) & 0xffffff).toString(16).padStart(6, '0')
  const c2 = '#' + ((hash * 2654435761 >>> 0) & 0xffffff).toString(16).padStart(6, '0')
  
  return { 
    background: `linear-gradient(135deg, ${c1}, ${c2})` 
  }
})
</script>

<style scoped>
.template-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border: 1px solid #d8e2ef;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.85);
  transition: all 0.25s ease;
}

.template-card--exact {
  border-color: #95de64;
  background: rgba(149, 222, 100, 0.08);
}

.template-card--nearest {
  border-color: #ffbb33;
  background: rgba(255, 187, 51, 0.08);
}

.template-card--resized {
  border-color: #91caff;
  background: rgba(145, 202, 255, 0.08);
}

.thumb {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 15px;
  font-weight: 600;
  color: #1d2630;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line {
  font-size: 13px;
  color: #556371;
  line-height: 1.4;
}

.line.diff {
  color: #d46b08;
  font-weight: 500;
}

.line.from {
  color: #8a9aa9;
  font-size: 12px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .template-card {
    background: rgba(46, 48, 50, 0.9);
    border-color: #3a4552;
  }
  
  .template-card--exact {
    border-color: #73c841;
    background: rgba(115, 200, 65, 0.12);
  }
  
  .template-card--nearest {
    border-color: #ff9f00;
    background: rgba(255, 159, 0, 0.12);
  }
  
  .template-card--resized {
    border-color: #69b7ff;
    background: rgba(105, 183, 255, 0.12);
  }
  
  .name {
    color: #e8edf2;
  }
  
  .line {
    color: #9aacbd;
  }
  
  .line.diff {
    color: #ff9f00;
  }
  
  .line.from {
    color: #6b7785;
  }
  
  .thumb {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  }
}
</style>
