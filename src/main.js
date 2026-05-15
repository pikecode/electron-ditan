import { createApp } from 'vue'
import App from './App.vue'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/700.css'
import './style.css'
import i18n from './i18n'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

createApp(App).use(i18n).use(ElementPlus).mount('#app')
