import 'element-plus/dist/index.css'
import './styles/global.scss'
import './types/router'

import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { permissionDirective } from './directives/permission'
import { i18n } from './i18n'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(ElementPlus, { size: 'default' })
app.directive('permission', permissionDirective)

app.mount('#app')
