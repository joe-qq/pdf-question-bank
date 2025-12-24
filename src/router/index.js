import { createRouter, createWebHistory } from 'vue-router'
import UploadPDF from '../views/UploadPDF.vue'
import QuestionBank from '../views/QuestionBank.vue'
import Practice from '../views/Practice.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/upload' },
    { path: '/upload', component: UploadPDF, name: 'UploadPDF' },
    { path: '/bank', component: QuestionBank, name: 'QuestionBank' },
    { path: '/practice', component: Practice, name: 'Practice' }
  ]
})

export default router