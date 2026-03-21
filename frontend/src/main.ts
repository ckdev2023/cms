import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { permissionDirective } from './directives/permission'
import { i18n } from './i18n'
import './types/router'
import './styles/global.scss'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(ElementPlus, { size: 'default' })
app.directive('permission', permissionDirective)

app.mount('#app')
