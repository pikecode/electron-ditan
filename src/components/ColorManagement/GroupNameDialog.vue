<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h4>{{ editingGroup ? $t('colorManagement.editGroup') : $t('colorManagement.newGroup') }}</h4>
        <button class="close-btn" @click="cancel">×</button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>{{ $t('colorManagement.groupName') }}</label>
          <input 
            type="text" 
            v-model="groupName" 
            :placeholder="$t('colorManagement.groupNamePlaceholder')"
            class="form-input"
            @keyup.enter="confirm"
            @keyup.esc="cancel"
            ref="inputRef"
          />
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="cancel">{{ $t('colorManagement.cancel') }}</button>
        <button class="btn btn-primary" @click="confirm" :disabled="!groupName.trim()">
          {{ editingGroup ? $t('colorManagement.save') : $t('colorManagement.create') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GroupNameDialog',
  props: {
    visible: { type: Boolean, default: false },
    editingGroup: { type: Object, default: null },
    initialName: { type: String, default: '' }
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      groupName: ''
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.groupName = this.initialName
        this.$nextTick(() => {
          if (this.$refs.inputRef) {
            this.$refs.inputRef.focus()
            if (this.editingGroup) {
              this.$refs.inputRef.select()
            }
          }
        })
      }
    }
  },
  methods: {
    confirm() {
      if (!this.groupName.trim()) return
      this.$emit('confirm', this.groupName.trim())
    },
    cancel() {
      this.$emit('cancel')
    },
    handleOverlayClick() {
      this.cancel()
    }
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.dialog {
  background: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.dialog-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #e9ecef;
  color: #333;
}

.dialog-body {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #007ACC;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #666;
}

.btn-secondary:hover {
  background: #f0f6ff;
  border-color: #007ACC;
  color: #007ACC;
}

.btn-primary {
  background: #007ACC;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #005a9e;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
