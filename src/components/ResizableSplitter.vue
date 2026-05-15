<template>
  <div 
    class="resizable-splitter"
    @mousedown="startDrag"
    :class="{ 'dragging': isDragging }"
  >
    <div class="splitter-line"></div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

export default {
  name: 'ResizableSplitter',
  props: {
    direction: {
      type: String,
      default: 'left', // 'left' , 'right' 
      validator: (value) => ['left', 'right'].includes(value)
    }
  },
  emits: ['resize'],
  setup(props, { emit }) {
    const isDragging = ref(false)
    let startX = 0
    let startWidth = 0

    const startDrag = (e) => {
      isDragging.value = true
      startX = e.clientX
      
      // direction
      if (props.direction === 'left') {
        const leftPanel = e.target.previousElementSibling
        if (leftPanel) {
          startWidth = leftPanel.offsetWidth
        }
      } else {
        // 
        const rightPanel = e.target.nextElementSibling
        if (rightPanel) {
          startWidth = rightPanel.offsetWidth
        }
      }

      document.addEventListener('mousemove', onDrag)
      document.addEventListener('mouseup', stopDrag)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      
      e.preventDefault()
    }

    const onDrag = (e) => {
      if (!isDragging.value) return
      
      const deltaX = e.clientX - startX
      let newWidth
      
      if (props.direction === 'left') {
        // 
        newWidth = startWidth + deltaX
      } else {
        // 
        newWidth = startWidth - deltaX
      }
      
      // 
      const minWidth = 200
      const maxWidth = window.innerWidth * 0.6
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        emit('resize', newWidth)
      }
      
      e.preventDefault()
    }

    const stopDrag = () => {
      isDragging.value = false
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    onUnmounted(() => {
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
    })

    return {
      isDragging,
      startDrag
    }
  }
}
</script>

<style scoped>
.resizable-splitter {
  width: 2px;
  background: transparent;
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  flex-shrink: 0;
}

.resizable-splitter:hover .splitter-line,
.resizable-splitter.dragging .splitter-line {
  background: #007acc;
  opacity: 1;
}

.splitter-line {
  width: 1px;
  height: 100%;
  background: #ddd;
  opacity: 0.6;
  transition: all 0.2s ease;
}

.resizable-splitter::before {
  content: '';
  position: absolute;
  left: -4px;
  right: -4px;
  top: 0;
  bottom: 0;
  background: transparent;
  z-index: 1;
}

.resizable-splitter.dragging {
  background: rgba(0, 122, 204, 0.1);
}


.resizable-splitter:hover::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 30px;
  background: #007acc;
  border-radius: 2px;
  opacity: 0.8;
}
</style> 