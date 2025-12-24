<template>
  <div class="container">
    <div class="nav-bar">
      <h1>在线刷题</h1>
      <div>
        <button class="btn btn-secondary mr-2" @click="router.push('/bank')">
          返回题库
        </button>
        <button class="btn btn-danger" @click="resetPractice">
          重置刷题
        </button>
      </div>
    </div>
    
    <div class="card">
      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">{{ currentIndex + 1 }} / {{ totalQuestions }}</div>
          <div class="stat-label">当前题目</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ answeredCount }}</div>
          <div class="stat-label">已答题数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ correctRate }}%</div>
          <div class="stat-label">正确率</div>
        </div>
      </div>
      
      <div v-if="!currentQuestion" class="empty">
        <p>暂无题目，请先上传题库</p>
      </div>
      
      <div v-else class="question-card">
        <div class="question-title">
          {{ currentQuestion.id }}. {{ currentQuestion.content }}
        </div>
        
        <div v-if="currentQuestion.options.length === 0">
          <p class="text-gray-500">该题目暂无选项</p>
        </div>
        
        <div v-else>
          <div 
            v-for="option in currentQuestion.options" 
            :key="option.key"
            class="option-item"
            :class="{
              selected: currentQuestion.userAnswer === option.key,
              correct: showAnswer && option.key === currentQuestion.answer,
              wrong: showAnswer && currentQuestion.userAnswer === option.key && option.key !== currentQuestion.answer
            }"
            @click="selectOption(option.key)"
          >
            {{ option.key }}. {{ option.value }}
          </div>
        </div>
        
        <div class="mt-4">
          <label class="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              v-model="showAnswer"
              class="form-checkbox"
            >
            <span class="ml-2">显示正确答案</span>
          </label>
        </div>
        
        <div v-if="showAnswer && currentQuestion.answer" class="mt-4 text-green-600">
          正确答案：{{ currentQuestion.answer }}
        </div>
        
        <div class="pagination">
          <button 
            class="btn btn-secondary"
            @click="prevQuestion"
            :disabled="currentIndex === 0"
          >
            上一题
          </button>
          
          <button 
            class="btn btn-secondary"
            @click="nextQuestion"
            :disabled="currentIndex === totalQuestions - 1"
          >
            下一题
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestionStore } from '../stores/questionStore'

const router = useRouter()
const questionStore = useQuestionStore()

// 显示答案开关
const showAnswer = ref(false)

// 计算属性
const currentQuestion = computed(() => questionStore.currentQuestion)
const currentIndex = computed(() => questionStore.currentQuestionIndex)
const totalQuestions = computed(() => questionStore.questions.length)
const answeredCount = computed(() => questionStore.answeredCount)
const correctRate = computed(() => questionStore.correctRate)

// 选择选项
const selectOption = (optionKey) => {
  if (currentQuestion.value) {
    questionStore.setUserAnswer(currentQuestion.value.id, optionKey)
  }
}

// 上一题
const prevQuestion = () => {
  questionStore.changeQuestionIndex(currentIndex.value - 1)
  showAnswer.value = false
}

// 下一题
const nextQuestion = () => {
  questionStore.changeQuestionIndex(currentIndex.value + 1)
  showAnswer.value = false
}

// 重置刷题
const resetPractice = () => {
  if (confirm('确定要重置刷题进度吗？')) {
    questionStore.resetPractice()
    showAnswer.value = false
  }
}
</script>