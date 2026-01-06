import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { authState } from './auth' // <--- Import Auth

import './assets/main.css'
import 'animate.css'

const app = createApp(App)

// NEW: Refresh user roles immediately on app start
authState.refreshSession(); 

app.use(i18n)
app.use(router)
app.mount('#app')
