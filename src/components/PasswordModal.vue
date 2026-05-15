<template>
  <!-- 旧用法：组件挂载即显示，由父组件 v-if 控制 -->
  <!-- 新用法：组件始终挂载，通过 visible 控制 -->
  <div v-if="shouldShow" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>{{ effectiveTitle }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="modal-body">
        <div class="password-form">
          <div class="lock-icon">🔒</div>
          <p class="description">{{ effectiveDescription }}</p>

          <div class="input-group">
            <input
                ref="passwordInput"
                type="password"
                v-model="password"
                :placeholder="$t('password.placeholder')"
                @keyup.enter="verify"
                :disabled="verifying"
                class="password-input"
            >
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <div class="button-group">
            <button @click="close" class="btn btn-cancel" :disabled="verifying">
              {{ $t('password.cancel') }}
            </button>
            <button @click="verify" class="btn btn-confirm" :disabled="!password || verifying">
              <span v-if="verifying" class="loading-spinner">⏳</span>
              {{ verifying ? $t('password.verifying') : $t('password.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {verifyPassword} from '../utils/permission'
import eventBus, {EVENT_TYPES} from '../utils/eventBus'

export default {
  name: 'PasswordModal',
  props: {
    // 是否使用全局模式（EventBus）
    // 旧用法不传，新用法传 :global-mode="true"
    globalMode: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      visible: false,
      password: '',
      verifying: false,
      errorMessage: '',
      modalTitle: '',
      modalDescription: ''
    }
  },
  computed: {
    shouldShow() {
      if (this.globalMode) {
        // 新用法：通过 visible 控制
        return this.visible
      } else {
        // 旧用法：组件挂载即显示，由父组件 v-if 控制
        return true
      }
    },
    effectiveTitle() {
      return this.modalTitle || this.$t('password.title')
    },
    effectiveDescription() {
      return this.modalDescription || this.$t('password.description')
    }
  },
  mounted() {
    // 监听显示密码弹窗事件（新用法）
    eventBus.on(EVENT_TYPES.SHOW_PASSWORD_MODAL, this.handleShowModal)

    // 如果是旧用法，自动聚焦
    if (!this.globalMode) {
      this.$nextTick(() => {
        if (this.$refs.passwordInput) {
          this.$refs.passwordInput.focus()
        }
      })
    }
  },
  beforeUnmount() {
    eventBus.off(EVENT_TYPES.SHOW_PASSWORD_MODAL, this.handleShowModal)
  },
  methods: {
    handleShowModal(options = {}) {
      this.modalTitle = options.title || this.$t('password.title')
      this.modalDescription = options.description || this.$t('password.description')
      this.visible = true
      this.password = ''
      this.errorMessage = ''

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = this.$refs.passwordInput
            if (el) {
              el.focus()
            }
          })
        })
      })
    },

    handleOverlayClick() {
      this.close()
    },

    close() {
      if (this.globalMode) {
        // 新用法：通过 EventBus
        this.visible = false
        eventBus.emit(EVENT_TYPES.PASSWORD_CANCELLED)
      } else {
        // 旧用法：触发 close 事件
        this.$emit('close')
      }
      this.password = ''
      this.errorMessage = ''
    },

    async verify() {
      if (!this.password || this.verifying) return

      this.verifying = true
      this.errorMessage = ''

      try {
        const isValid = verifyPassword(this.password)

        if (isValid) {
          if (this.globalMode) {
            // 新用法：通过 EventBus
            this.visible = false
            eventBus.emit(EVENT_TYPES.PASSWORD_VERIFIED)
          } else {
            // 旧用法：触发 verified 事件
            this.$emit('verified')
          }
          this.password = ''
        } else {
          this.errorMessage = this.$t('password.incorrect')
          this.password = ''
          this.$nextTick(() => {
            requestAnimationFrame(() => {
              const el = this.$refs.passwordInput
              if (el) el.focus()
            })
          })
        }
      } catch (error) {
        console.error('Password verification error:', error)
        this.errorMessage = this.$t('password.error')
      } finally {
        this.verifying = false
      }
    }
  },
  emits: ['close', 'verified']
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  animation: modalFadeIn 0.3s ease;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: #333;
  background: #f5f5f5;
}

.modal-body {
  padding: 24px;
}

.password-form {
  text-align: center;
}

.lock-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.8;
}

.description {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
  line-height: 1.5;
}

.input-group {
  margin-bottom: 16px;
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  text-align: center;
  letter-spacing: 2px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.password-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}

.password-input:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  font-size: 14px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #fdf2f2;
  border: 1px solid #fadbd8;
  border-radius: 6px;
}

.button-group {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-cancel {
  background: #f8f9fa;
  color: #666;
  border: 1px solid #ddd;
}

.btn-cancel:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #adb5bd;
}

.btn-confirm {
  background: #007acc;
  color: white;
  border: 1px solid #007acc;
}

.btn-confirm:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>