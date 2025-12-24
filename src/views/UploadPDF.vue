<template>
  <div class="container">
    <div class="nav-bar">
      <h1>题库PDF上传</h1>
    </div>
    
    <div class="card">
      <div 
        class="upload-area"
        @click="triggerFileInput"
        @drop="handleDrop"
        @dragover.prevent
      >
        <input 
          type="file" 
          ref="fileInput" 
          accept=".pdf" 
          @change="handleFileSelect"
        >
        <h2>点击或拖拽PDF文件到此处上传</h2>
        <p class="mt-2 text-gray-500">支持解析包含选择题的PDF题库</p>
        
        <div v-if="uploading && !ocrProcessing" class="loading">
          <p>正在解析PDF，请稍候...</p>
        </div>
      </div>
      
      <!-- OCR进度显示（在上传区域外） -->
      <div v-if="ocrProcessing" class="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
        <p class="font-semibold text-blue-800 mb-2">{{ ocrStatus.message || '正在OCR识别...' }}</p>
        <div v-if="ocrStatus.progress !== undefined" class="mt-2">
          <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              :style="{ width: (ocrStatus.progress * 100) + '%' }"
            ></div>
          </div>
          <p class="text-xs text-gray-600 mt-1">{{ Math.round(ocrStatus.progress * 100) }}%</p>
        </div>
      </div>
      
      <!-- 错误信息和OCR选项（在上传区域外） -->
      <div v-if="error" class="mt-4">
        <div class="text-red-500 whitespace-pre-line p-4 bg-red-50 rounded border border-red-200">
          {{ error }}
        </div>
        <div v-if="showOcrOption" class="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
          <p class="text-sm text-blue-800 font-semibold mb-2">💡 本地OCR识别</p>
          <p class="text-xs text-blue-700 mb-3">
            检测到扫描件PDF，可以使用本地OCR功能进行识别（需要一些时间）
          </p>
          <button 
            @click.stop="startOCR"
            :disabled="ocrProcessing"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ ocrProcessing ? '识别中...' : '开始OCR识别' }}
          </button>
        </div>
      </div>
      
      <div v-if="pdfText" class="mt-4">
        <div class="flex justify-between items-center mb-2">
          <h3>解析结果预览</h3>
          <button 
            @click="showFullText = !showFullText"
            class="text-sm text-blue-600 hover:text-blue-800"
          >
            {{ showFullText ? '收起' : '查看完整文本' }}
          </button>
        </div>
        <div class="mt-2 p-4 bg-gray-50 rounded overflow-auto" :class="showFullText ? 'max-h-96' : 'max-h-60'">
          <p class="whitespace-pre-wrap text-sm font-mono">{{ showFullText ? pdfText : pdfText.substring(0, 1000) }}{{ !showFullText && pdfText.length > 1000 ? '...' : '' }}</p>
        </div>
        
        <div class="mt-4 p-4 bg-blue-50 rounded">
          <p class="text-sm text-gray-700">
            <strong>解析状态：</strong>
            <span v-if="questionStore.questions.length > 0" class="text-green-600 font-bold">
              成功解析出 {{ questionStore.questions.length }} 道题目
            </span>
            <span v-else class="text-orange-600 font-bold">
              未识别到题目，请检查PDF格式。文本长度：{{ pdfText.length }} 字符
            </span>
          </p>
          <p v-if="questionStore.questions.length === 0" class="text-xs text-gray-500 mt-2">
            <strong>提示：</strong>题目格式应为 "1. 题目内容" 或 "1、题目内容"，选项格式应为 "A. 选项内容" 或 "A、选项内容"。
            <br>请打开浏览器控制台（F12）查看详细的解析日志，包括完整的文本内容和匹配结果。
          </p>
          <div v-if="questionStore.questions.length === 0" class="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
            <p class="text-xs text-yellow-800 font-semibold mb-1">🔍 调试信息：</p>
            <p class="text-xs text-yellow-700">
              如果题目仍未识别，请检查控制台中的"前20行内容"，确认PDF文本格式是否正确。
              <br>如果文本格式与预期不符，可能需要调整解析规则。
            </p>
          </div>
        </div>
        
        <div class="mt-4 flex justify-end gap-2">
          <button 
            class="btn"
            @click="toQuestionBank"
            :disabled="questionStore.questions.length === 0"
            :class="{ 'opacity-50 cursor-not-allowed': questionStore.questions.length === 0 }"
          >
            进入题库管理 ({{ questionStore.questions.length }}题)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as pdfjsLib from 'pdfjs-dist'
import { useQuestionStore } from '../stores/questionStore'
import { ocrPdf } from '../utils/ocr.js'

// ✅ 修复Worker配置：使用本地文件，避免CDN加载失败
// 使用 public 目录中的 worker 文件，确保在所有环境下都能正常工作
onMounted(() => {
  if (typeof window !== 'undefined') {
    // 使用 public 目录中的 worker 文件
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  }
})

const router = useRouter()
const questionStore = useQuestionStore()
const fileInput = ref(null)
const uploading = ref(false)
const error = ref('')
const pdfText = ref('')
const showFullText = ref(false)
const ocrProcessing = ref(false)
const ocrStatus = ref({ message: '', progress: 0 })
const showOcrOption = ref(false)
const currentPdfFile = ref(null) // 保存当前PDF文件，用于OCR

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value.click()
}

// 处理文件选择
const handleFileSelect = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  if (file.type !== 'application/pdf') {
    error.value = '请上传PDF格式的文件'
    // 重置文件输入，允许重新选择
    e.target.value = ''
    return
  }
  
  currentPdfFile.value = file // 保存文件用于OCR
  await parsePDF(file)
  // 重置文件输入，允许重复选择同一文件
  e.target.value = ''
}

// 处理拖拽上传
const handleDrop = async (e) => {
  e.preventDefault()
  const file = e.dataTransfer.files[0]
  if (!file || file.type !== 'application/pdf') {
    error.value = '请上传PDF格式的文件'
    return
  }
  
  currentPdfFile.value = file // 保存文件用于OCR
  await parsePDF(file)
}

// 解析PDF文件（优化版，兼容中文/空文本）
const parsePDF = async (file) => {
  try {
    uploading.value = true
    error.value = ''
    pdfText.value = '' // 清空之前的解析结果
    
    const arrayBuffer = await file.arrayBuffer()
    // 配置PDF解析选项，支持中文
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      // 移除 cMapUrl，使用默认配置，避免CDN加载失败
      // 如果需要更好的中文支持，可以后续配置本地 cMap 文件
      verbosity: 0 // 减少控制台输出
    })
    
    const pdf = await loadingTask.promise
    // 保存PDF文件用于OCR（不保存PDF对象，因为可能有私有成员问题）
    
    let fullText = ''
    let questionStartPage = 1 // 题目开始的页码
    let blankPageCount = 0
    let imagePageCount = 0
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      
      // 检查页面是否有文本内容
      const items = textContent.items.filter(item => item.str && item.str.trim())
      
      // 检查页面是否有图像（图片型PDF的特征）
      let hasImages = false
      try {
        const opList = await page.getOperatorList()
        // 检查操作符列表中是否有图像相关的操作
        hasImages = opList.fnArray.some(op => {
          // PDF操作符：Do (图像绘制), BI/ID/EI (内联图像)
          return op === 45 || op === 46 || op === 47 || op === 60 || op === 61 || op === 62
        })
      } catch (e) {
        // 如果无法获取操作符列表，忽略
      }
      
      if (items.length === 0) {
        blankPageCount++
        if (hasImages) {
          imagePageCount++
          console.log(`第 ${i} 页：图片型页面（扫描件），无法提取文本`)
        } else {
          console.log(`第 ${i} 页：空白页，跳过`)
        }
        continue
      }
      
      // 检查是否是目录页、封面页等非题目页面
      const pageText = items.map(item => item.str).join(' ')
      const lowerText = pageText.toLowerCase()
      
      // 跳过目录、封面、知识梳理等页面
      if (lowerText.includes('目录') || 
          lowerText.includes('mùlù') ||
          lowerText.includes('知识梳理') ||
          lowerText.includes('本书知识') ||
          lowerText.includes('图书在版编目') ||
          lowerText.includes('cip数据') ||
          lowerText.includes('isbn') ||
          lowerText.includes('出版社') ||
          (pageText.length < 50 && !/\d+[.、]\s*[^0-9]/.test(pageText))) {
        console.log(`第 ${i} 页：非题目页面（${pageText.substring(0, 30)}...），跳过`)
        continue
      }
      
      // 如果还没找到题目开始页，记录当前页
      if (questionStartPage === 1 && /\d+[.、]\s*[^0-9]/.test(pageText)) {
        questionStartPage = i
        console.log(`题目从第 ${i} 页开始`)
      }
      
      // 改进的文本提取：按Y坐标分组识别行
      const lines = {}
      items.forEach(item => {
        // 使用更精确的Y坐标分组（保留1位小数）
        const y = Math.round(item.transform[5] * 10) / 10
        if (!lines[y]) {
          lines[y] = []
        }
        lines[y].push({
          x: item.transform[4],
          text: item.str.trim()
        })
      })
      
      // 按Y坐标排序（从上到下）
      const sortedY = Object.keys(lines).sort((a, b) => parseFloat(b) - parseFloat(a))
      
      // 构建页面文本，每行单独处理
      let pageTextLines = []
      sortedY.forEach(y => {
        // 按X坐标排序（从左到右）
        const lineItems = lines[y].sort((a, b) => a.x - b.x)
        const lineText = lineItems.map(item => item.text).join(' ').trim()
        if (lineText.length > 0) {
          pageTextLines.push(lineText)
        }
      })
      
      // 如果页面包含题目格式的内容，添加到全文
      if (pageTextLines.length > 0) {
        // 检查是否包含题目格式（数字开头）
        const hasQuestionFormat = pageTextLines.some(line => /^\d+[.、]\s*/.test(line))
        if (hasQuestionFormat || i >= questionStartPage) {
          fullText += pageTextLines.join('\n') + '\n\n'
        }
      }
    }
    
    // 清理文本：移除多余的空行和空格
    fullText = fullText
      .replace(/\n{3,}/g, '\n\n') // 多个连续换行合并为两个
      .replace(/[ \t]{2,}/g, ' ') // 多个空格合并为一个
      .trim()
    
    // 检查是否只包含空白字符
    const hasNonWhitespace = /\S/.test(fullText)
    
    // 无文本提示
    if (!fullText || !hasNonWhitespace) {
      uploading.value = false
      
      // 判断：如果所有页面都没有文本，很可能是扫描件
      const isScannedPDF = blankPageCount === pdf.numPages && pdf.numPages > 0
      showOcrOption.value = isScannedPDF || imagePageCount > 0 // 显示OCR选项
      
      // 根据情况提供更具体的错误信息
      let errorMsg = ''
      if (isScannedPDF || imagePageCount > 0) {
        errorMsg = `⚠️ PDF是扫描件（图片型），无法直接提取文本\n\n`
        errorMsg += `检测结果：\n`
        errorMsg += `- 总页数：${pdf.numPages} 页\n`
        errorMsg += `- 可提取文本的页面：0 页\n`
        errorMsg += `- 所有页面都是图片，需要OCR识别\n\n`
        errorMsg += `💡 提示：可以使用下方的"本地OCR识别"功能，或使用其他OCR工具处理`
      } else {
        errorMsg = `PDF解析成功，但未提取到有效文本\n\n`
        errorMsg += `统计信息：\n`
        errorMsg += `- 总页数：${pdf.numPages}\n`
        errorMsg += `- 空白页：${blankPageCount}\n`
        errorMsg += `- 图片页：${imagePageCount}\n\n`
        errorMsg += `可能原因：\n`
        errorMsg += `1. PDF是图片型（扫描件），需要OCR处理\n`
        errorMsg += `2. PDF内容被加密或受保护\n`
        errorMsg += `3. PDF文本格式特殊`
      }
      error.value = errorMsg
      
      console.warn('⚠️ 提取的文本只包含空白字符')
      console.log('PDF统计信息：')
      console.log(`- 总页数：${pdf.numPages}`)
      console.log(`- 空白页数：${blankPageCount}`)
      console.log(`- 图片页数：${imagePageCount}`)
      if (fullText) {
        console.log('提取的文本（JSON格式）:', JSON.stringify(fullText.substring(0, 200)))
      }
      return
    }
    
    pdfText.value = fullText
    questionStore.setPdfText(fullText)
    uploading.value = false
    
    // 调试信息：显示解析结果（确保在控制台可见）
    console.log('%c========== PDF解析结果 ==========', 'color: blue; font-weight: bold; font-size: 14px;')
    console.log('PDF文本长度:', fullText.length)
    console.log('文本行数（包含空行）:', fullText.split('\n').length)
    
    // 显示非空行
    const allLines = fullText.split('\n')
    const nonEmptyLines = allLines.filter(line => line.trim().length > 0)
    console.log('非空行数:', nonEmptyLines.length)
    
    if (nonEmptyLines.length > 0) {
      console.log('%c前20个非空行内容:', 'color: green; font-weight: bold;')
      nonEmptyLines.slice(0, 20).forEach((line, idx) => {
        console.log(`  ${idx + 1}:`, line.trim())
      })
    } else {
      console.warn('%c⚠️ 没有找到非空行！', 'color: red; font-weight: bold;')
      console.log('原始文本（JSON格式，显示不可见字符）:')
      console.log(JSON.stringify(fullText.substring(0, 500)))
      console.log('原始文本（直接显示）:')
      console.log(fullText.substring(0, 500))
    }
    
    console.log('完整文本内容（前1000字符）:')
    console.log(fullText.substring(0, 1000))
    
    // 等待一下让store完成解析
    setTimeout(() => {
      console.log('解析出的题目数量:', questionStore.questions.length)
      if (questionStore.questions.length > 0) {
        console.log('第一题:', questionStore.questions[0])
      }
      console.log('%c================================', 'color: blue; font-weight: bold;')
    }, 100)
    if (questionStore.questions.length > 0) {
      console.log('解析出的题目:', questionStore.questions)
    } else {
      console.warn('⚠️ 未识别到题目，请检查PDF格式')
      console.log('尝试匹配的格式示例:')
      console.log('- 题目: "1. 内容" 或 "1、内容"')
      console.log('- 选项: "A. 内容" 或 "A、内容"')
    }
    console.log('================================')
    
  } catch (err) {
    uploading.value = false
    // 提供更详细的错误信息
    let errorMessage = 'PDF解析失败：'
    if (err.name === 'InvalidPDFException') {
      errorMessage += '无效的PDF文件，请检查文件是否损坏'
    } else if (err.name === 'MissingPDFException') {
      errorMessage += 'PDF文件缺失或无法读取'
    } else if (err.name === 'UnexpectedResponseException') {
      errorMessage += 'Worker加载失败，请刷新页面重试'
    } else {
      errorMessage += err.message || '未知错误'
    }
    error.value = errorMessage
    console.error('PDF解析错误详情：', {
      name: err.name,
      message: err.message,
      stack: err.stack
    })
  }
}

// 开始OCR识别
const startOCR = async () => {
  if (!currentPdfFile.value) {
    error.value = 'PDF文件不存在，请重新上传文件'
    return
  }
  
  try {
    ocrProcessing.value = true
    uploading.value = true
    error.value = ''
    ocrStatus.value = { message: '正在加载PDF文件...', progress: 0 }
    
    // 重新加载PDF文件（避免私有成员问题）
    const arrayBuffer = await currentPdfFile.value.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0
    })
    const pdf = await loadingTask.promise
    
    ocrStatus.value = { message: '正在初始化OCR引擎（首次使用需要下载语言包）...', progress: 0.05 }
    
    console.log('开始OCR识别，总页数:', pdf.numPages)
    
    // 执行OCR识别
    const recognizedText = await ocrPdf(pdf, {
      scale: 3, // 提高缩放比例，提高识别准确率（特别是数字和公式）
      lang: 'chi_sim+eng', // 简体中文+英文
      onProgress: (progress) => {
        ocrStatus.value = {
          message: progress.message || `处理第 ${progress.page}/${progress.total} 页`,
          progress: progress.progress !== undefined 
            ? 0.1 + (progress.progress * 0.9) // 前10%用于初始化，后90%用于识别
            : 0.1 + ((progress.page / progress.total) * 0.9)
        }
        console.log('OCR进度:', ocrStatus.value)
      }
    })
    
    if (!recognizedText || !recognizedText.trim()) {
      throw new Error('OCR识别失败，未提取到文本')
    }
    
    // 处理识别结果
    pdfText.value = recognizedText
    questionStore.setPdfText(recognizedText)
    showOcrOption.value = false
    error.value = ''
    
    console.log('OCR识别完成，文本长度:', recognizedText.length)
    console.log('识别出的题目数量:', questionStore.questions.length)
    
  } catch (err) {
    console.error('OCR识别错误:', err)
    error.value = `OCR识别失败：${err.message}\n\n请尝试：\n1. 检查PDF图片质量\n2. 使用其他OCR工具处理\n3. 确保网络连接正常（首次使用需要下载语言包）`
  } finally {
    ocrProcessing.value = false
    uploading.value = false
    ocrStatus.value = { message: '', progress: 0 }
  }
}

// 跳转到题库管理
const toQuestionBank = () => {
  router.push('/bank')
}
</script>