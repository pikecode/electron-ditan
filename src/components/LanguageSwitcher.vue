<template>
  <div
    class="language-switcher"
    :class="{ compact, 'is-open': isDropdownOpen }"
    @mouseenter="onSwitcherEnter"
    @mouseleave="onSwitcherLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <div
      class="current-language"
      role="button"
      tabindex="0"
      :aria-label="t('appShell.languageMenuAria')"
      :aria-expanded="isDropdownOpen"
      aria-haspopup="listbox"
      @click.stop="toggleDropdown"
      @keydown.enter.prevent="toggleDropdown"
      @keydown.space.prevent="toggleDropdown"
      @keydown.escape.stop="closeDropdown"
    >
      <span class="language-icon" aria-hidden="true">🌐</span>
      <span class="language-code" :aria-hidden="compact && !isRevealed">{{ shortLabel }}</span>
      <span
        class="dropdown-arrow"
        :class="{ open: isDropdownOpen }"
        :aria-hidden="compact && !isRevealed"
      >▾</span>
    </div>

    <transition name="lang-fade">
      <ul
        v-if="isDropdownOpen"
        class="language-dropdown"
        role="listbox"
        :aria-label="t('appShell.languageHint')"
      >
        <li
          v-for="lang in availableLanguages"
          :key="lang.code"
          role="option"
          :aria-selected="lang.code === currentLangCode"
          class="language-option"
          :class="{ active: lang.code === currentLangCode }"
          @click.stop="selectLanguage(lang.code)"
        >
          <span class="language-name">{{ lang.nativeName }}</span>
          <span class="language-english">{{ lang.name }}</span>
        </li>
      </ul>
    </transition>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { switchLanguage, getCurrentLanguage, getAvailableLanguages } from '../i18n'

export default {
  name: 'LanguageSwitcher',
  props: {
    /** 修图/合图等非首页场景：默认可为圆形仅图标，悬停或展开下拉时再显示完整胶囊 */
    compact: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const { t } = useI18n()
    const isDropdownOpen = ref(false)
    const isHovering = ref(false)
    const isFocusInside = ref(false)

    const currentLangCode = computed(() => getCurrentLanguage())
    const available = computed(() => getAvailableLanguages())

    
    const shortLabel = computed(() => (currentLangCode.value === 'zh' ? 'ZH' : 'EN'))

    const isRevealed = computed(
      () =>
        !props.compact ||
        isDropdownOpen.value ||
        isHovering.value ||
        isFocusInside.value
    )

    function onSwitcherEnter() {
      isHovering.value = true
    }

    function onSwitcherLeave() {
      isHovering.value = false
    }

    function onFocusIn() {
      isFocusInside.value = true
    }

    function onFocusOut(e) {
      const root = e.currentTarget
      const next = e.relatedTarget
      if (next && root.contains(next)) return
      isFocusInside.value = false
    }

    function closeDropdown() {
      isDropdownOpen.value = false
    }

    function toggleDropdown() {
      isDropdownOpen.value = !isDropdownOpen.value
    }

    function selectLanguage(langCode) {
      if (switchLanguage(langCode)) {
        isDropdownOpen.value = false
      }
    }

    function handleClickOutside(event) {
      if (!event.target.closest('.language-switcher')) {
        isDropdownOpen.value = false
      }
    }

    function onGlobalKeydown(e) {
      if (e.key === 'Escape') closeDropdown()
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', onGlobalKeydown)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', onGlobalKeydown)
    })

    return {
      t,
      compact: toRef(props, 'compact'),
      isDropdownOpen,
      isHovering,
      isRevealed,
      onSwitcherEnter,
      onSwitcherLeave,
      onFocusIn,
      onFocusOut,
      currentLangCode,
      availableLanguages: available,
      shortLabel,
      toggleDropdown,
      closeDropdown,
      selectLanguage
    }
  }
}
</script>

<style scoped>
.language-switcher {
  position: relative;
  display: inline-block;
}


.current-language {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px 0 10px;
  height: 32px;
  min-height: 32px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.82);
  border: none;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #007aff;
  user-select: none;
}

.current-language:hover {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.current-language:focus-visible {
  outline: 2px solid #007aff;
  outline-offset: 2px;
}

.current-language:active {
  transform: scale(0.97);
}

.language-icon {
  font-size: 16px;
  line-height: 1;
  opacity: 0.92;
  flex-shrink: 0;
}

/* 修图/合图：默认圆形仅图标，悬停、键盘焦点或展开下拉时变为胶囊，避免挡住步骤条 */
/* 用固定 width 过渡（避免 max-width + width:auto 无法插值导致顿挫）；32×32 + radius 16 即圆形 */
.language-switcher.compact .current-language {
  width: 32px;
  min-width: 32px;
  max-width: none;
  padding-left: 0;
  padding-right: 0;
  justify-content: center;
  gap: 0;
  border-radius: 16px;
  overflow: hidden;
  box-sizing: border-box;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    gap 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease;
}

.language-switcher.compact .language-code,
.language-switcher.compact .dropdown-arrow {
  flex: 0 0 0;
  min-width: 0;
  width: 0;
  max-width: none;
  opacity: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  pointer-events: none;
  white-space: nowrap;
  transition: opacity 0.14s ease;
}

.language-switcher.compact:hover .current-language,
.language-switcher.compact:focus-within .current-language,
.language-switcher.compact.is-open .current-language {
  /* 固定展开宽度：ZH/EN + 箭头 + 内边距（可插值，动画顺） */
  width: 118px;
  min-width: 118px;
  padding: 0 12px 0 10px;
  justify-content: flex-start;
  gap: 5px;
}

.language-switcher.compact:hover .language-code,
.language-switcher.compact:focus-within .language-code,
.language-switcher.compact.is-open .language-code {
  flex: 0 0 auto;
  width: auto;
  min-width: 2em;
  opacity: 1;
  pointer-events: auto;
  transition: opacity 0.16s ease 0.04s;
}

.language-switcher.compact:hover .dropdown-arrow,
.language-switcher.compact:focus-within .dropdown-arrow,
.language-switcher.compact.is-open .dropdown-arrow {
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
  opacity: 0.75;
  margin-left: -2px;
  pointer-events: auto;
  transition: opacity 0.16s ease 0.04s;
}

@media (prefers-reduced-motion: reduce) {
  .language-switcher.compact .current-language,
  .language-switcher.compact .language-code,
  .language-switcher.compact .dropdown-arrow {
    transition: none;
  }
}

.language-code {
  color: #007aff;
  min-width: 2em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.dropdown-arrow {
  font-size: 10px;
  color: #007aff;
  opacity: 0.75;
  transition: transform 0.2s ease;
  margin-left: -2px;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.language-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: auto;
  min-width: 168px;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 10003;
}

/* 填满按钮与菜单之间的空隙，移入菜单时不会误触发父级 mouseleave 导致紧凑态收起 */
.language-dropdown::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  height: 8px;
}

.lang-fade-enter-active,
.lang-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.lang-fade-enter-from,
.lang-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.language-option {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-radius: 10px;
  margin-bottom: 2px;
}

.language-option:last-child {
  margin-bottom: 0;
}

.language-option:hover {
  background: rgba(0, 122, 255, 0.08);
}

.language-option.active {
  background: rgba(0, 122, 255, 0.14);
  box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.2) inset;
}

.language-option .language-name {
  font-size: 13px;
  font-weight: 600;
  color: #111;
  margin: 0;
}

.language-option .language-english {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

@media (prefers-color-scheme: dark) {
  .current-language {
    background: rgba(46, 48, 50, 0.88);
    color: #7dc4ff;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  }
  .current-language:hover {
    background: rgba(55, 58, 60, 0.95);
  }
  .language-code,
  .dropdown-arrow {
    color: #7dc4ff;
  }
  .language-dropdown {
    background: rgba(40, 42, 45, 0.96);
    border-color: rgba(255, 255, 255, 0.1);
  }
  .language-option .language-name {
    color: #e8eaed;
  }
  .language-option .language-english {
    color: #9aa0a6;
  }
}
</style>
