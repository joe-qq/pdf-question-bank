<template>
  <div class="container">
    <div class="nav-bar">
      <h1>题库管理</h1>
      <div>
        <button class="btn btn-secondary mr-2" @click="router.push('/upload')">
          重新上传
        </button>
        <button class="btn btn-danger" @click="clearBank">
          清空题库
        </button>
        <button class="btn ml-2" @click="startPractice">
          开始刷题
        </button>
      </div>
    </div>
    
    <div class="card">
      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">{{ questions.length }}</div>
          <div class="stat-label">题目总数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ hasAnswerCount }}</div>
          <div class="stat-label">含答案题目数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ hasOptionsCount }}</div>
          <div class="stat-label">含选项题目数</div>
        </div>
      </div>
      
      <div v-if="questions.length === 0" class="empty">
        <p>暂无题目，请先上传并解析PDF文件</p>
      </div>
      
      <div v-else class="question-list">
        <div 
          v-for="question in questions" 
          :key="question.id"
          class="question-item"
          @click="selectQuestion(question)"
        >
          <div class="font-bold">
            {{ question.id }}. {{ question.content }}
          </div>
          <div v-if="question.options.length" class="mt-2">
            <div 
              v-for="option in question.options" 
              :key="option.key"
              class="option-item-inline"
              :class="{
                selected: question.userAnswer === option.key,
                correct: question.answer && option.key === question.answer,
                wrong: question.userAnswer && question.userAnswer === option.key && question.answer && option.key !== question.answer
              }"
              @click.stop="selectOption(question, option.key)"
            >
              <span class="option-key">{{ option.key }}.</span>
              <span class="option-value">{{ option.value }}</span>
            </div>
          </div>
          <div v-else class="mt-2 text-sm text-gray-500">
            该题目暂无选项
          </div>
          <div v-if="question.answer" class="mt-2 text-sm text-green-600 font-semibold">
            正确答案：{{ question.answer }}
          </div>
          <div v-if="question.userAnswer && !question.answer" class="mt-2 text-sm text-blue-600">
            你的答案：{{ question.userAnswer }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestionStore } from '../stores/questionStore'

const router = useRouter()
const questionStore = useQuestionStore()

// 题库数据
const questions = computed(() => questionStore.questions)

// 统计数据
const hasAnswerCount = computed(() => {
  return questions.value.filter(q => q.answer).length
})

const hasOptionsCount = computed(() => {
  return questions.value.filter(q => q.options.length > 0).length
})

// 清空题库
const clearBank = () => {
  if (confirm('确定要清空题库吗？')) {
    questionStore.clearBank()
    router.push('/upload')
  }
}

// 开始刷题
const startPractice = () => {
  if (questions.value.length === 0) {
    alert('暂无题目，无法开始刷题')
    return
  }
  router.push('/practice')
}

// 选择题目（可扩展编辑功能）
const selectQuestion = (question) => {
  // 可扩展题目编辑功能
  console.log('选中题目：', question)
}

// 选择选项
const selectOption = (question, optionKey) => {
  questionStore.setUserAnswer(question.id, optionKey)
  console.log(`题目 ${question.id} 选择了选项 ${optionKey}`)
}
</script>