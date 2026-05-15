import { createI18n } from 'vue-i18n'
import zh from './locales/zh.js'
import en from './locales/en.js'

// 从 localStorage 读取语言；无记录时默认中文（与产品默认一致）
const getStoredLocale = () => {
  const stored = localStorage.getItem('diamondcraft-locale')
  if (stored && ['zh', 'en'].includes(stored)) {
    return stored
  }
  return 'zh'
}

// 保存语言到localStorage
const saveLocale = (locale) => {
  localStorage.setItem('diamondcraft-locale', locale)
}

function applyDocumentLang(locale) {
  try {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  } catch (_) {}
}

const messages = {
  zh,
  en
}

const initialLocale = getStoredLocale()
applyDocumentLang(initialLocale)

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: initialLocale,
  fallbackLocale: 'zh',
  messages,
  globalInjection: true // 允许在模板中直接使用 $t
})

// 导出切换语言的函数
export const switchLanguage = (locale) => {
  if (messages[locale]) {
    i18n.global.locale.value = locale
    saveLocale(locale)
    applyDocumentLang(locale)
    return true
  }
  return false
}

// 获取当前语言
export const getCurrentLanguage = () => {
  return i18n.global.locale.value
}

// 获取可用语言列表
export const getAvailableLanguages = () => {
  return [
    { code: 'zh', name: '中文', nativeName: '中文' },
    { code: 'en', name: 'English', nativeName: 'English' }
  ]
}

export default i18n 