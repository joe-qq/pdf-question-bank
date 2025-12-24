//状态管理
import { defineStore } from 'pinia'

export const useQuestionStore = defineStore('question', {
  state: () => ({
    // 原始PDF文本
    pdfText: '',
    // 解析后的题目列表
    questions: [],
    // 当前刷题进度
    currentQuestionIndex: 0,
    // 答题记录
    answers: {}
  }),
  actions: {
    // 设置PDF文本
    setPdfText(text) {
      this.pdfText = text
      this.parseQuestions()
    },
    // 解析题目（增强版，支持多种格式）
    parseQuestions() {
      if (!this.pdfText) return
      
      // 清理文本：移除多余空格，统一换行符
      let text = this.pdfText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // 多个连续换行合并为两个
        .trim()
      
      // 如果文本很少换行，尝试按数字分割（处理所有内容在一行的情况）
      let lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
      
      // 如果过滤后行数很少，可能是文本格式问题，尝试更宽松的过滤
      if (lines.length < 5 && text.length > 100) {
        console.log('⚠️ 过滤后行数很少，尝试保留更多内容...')
        // 只过滤完全空白的行
        lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0 || line.match(/\S/))
      }
      
      // 如果行数很少但文本很长，可能是所有内容在一行，尝试按题目分割
      if (lines.length < 10 && text.length > 100) {
        console.log('⚠️ 检测到文本可能在一行，尝试按题目分割...')
        // 改进的分割方法：按题目编号分割
        // 匹配模式：数字 + 点/顿号 + 空格 + 内容（直到下一个数字开头）
        const questionPattern = /(\d+[.、]\s+)(.+?)(?=\d+[.、]\s+|$)/g
        const matches = []
        let match
        
        while ((match = questionPattern.exec(text)) !== null) {
          const questionNum = match[1].trim()
          const questionContent = match[2].trim()
          if (questionContent.length > 3) {
            matches.push(questionNum + questionContent)
          }
        }
        
        if (matches.length > 0) {
          console.log('成功分割，得到', matches.length, '个可能的题目')
          return this.parseQuestionsFromLines(matches)
        }
        
        // 如果上面的方法不行，尝试简单的按数字分割
        const simplePattern = /(\d+[.、]\s*)/g
        const parts = text.split(simplePattern)
        if (parts.length > 3) {
          console.log('使用简单分割，得到', Math.floor(parts.length / 2), '个可能的题目段')
          const newLines = []
          for (let i = 0; i < parts.length - 1; i += 2) {
            if (parts[i] && parts[i + 1]) {
              const combined = (parts[i] + parts[i + 1]).trim()
              if (combined.length > 3) {
                newLines.push(combined)
              }
            }
          }
          if (newLines.length > 0) {
            return this.parseQuestionsFromLines(newLines)
          }
        }
      }
      
      return this.parseQuestionsFromLines(lines)
    },
    // 从行数组解析题目
    parseQuestionsFromLines(lines) {
      const questions = []
      let currentQuestion = null
      
      console.log('========== 题目解析开始 ==========')
      console.log('总行数:', lines.length)
      console.log('原始文本长度:', this.pdfText.length)
      // 计算清理后的文本长度（所有行加起来）
      const cleanedTextLength = lines.join('\n').length
      console.log('清理后文本长度（估算）:', cleanedTextLength)
      
      // 显示非空行的内容
      const nonEmptyLines = lines.filter(line => line.length > 0)
      console.log('非空行数:', nonEmptyLines.length)
      
      if (nonEmptyLines.length > 0) {
        console.log('前20个非空行内容:')
        nonEmptyLines.slice(0, 20).forEach((line, idx) => {
          console.log(`  ${idx + 1}: "${line}"`)
        })
      } else {
        console.warn('⚠️ 没有找到非空行！')
        console.log('原始文本前500字符:')
        console.log(this.pdfText.substring(0, 500))
        console.log('原始文本（显示不可见字符）:')
        console.log(JSON.stringify(this.pdfText.substring(0, 200)))
      }
      
      // 尝试查找可能的题目模式
      console.log('查找题目模式...')
      // 支持多种题目格式：数字开头、例X、第X题等
      const possibleQuestions = lines.filter(line => 
        /^\d+[.、\s]/.test(line) ||  // 数字开头
        /^例\d+/.test(line) ||        // 例X格式
        /^第\s*\d+/.test(line)        // 第X题格式
      )
      console.log('可能的题目行数:', possibleQuestions.length)
      if (possibleQuestions.length > 0) {
        console.log('前10个可能的题目:')
        possibleQuestions.slice(0, 10).forEach((line, idx) => {
          console.log(`  ${idx + 1}: "${line}"`)
        })
      } else {
        console.warn('⚠️ 未找到标准题目格式')
        // 尝试查找所有包含数字的行
        const linesWithNumbers = lines.filter(line => /\d+/.test(line))
        console.log('包含数字的行数:', linesWithNumbers.length)
        if (linesWithNumbers.length > 0) {
          console.log('前10个包含数字的行:')
          linesWithNumbers.slice(0, 10).forEach((line, idx) => {
            console.log(`  ${idx + 1}: "${line}"`)
          })
        }
      }
      
      lines.forEach((line, index) => {
        // 跳过空行和过短的行
        if (line.length < 2) return
        
        // 匹配题目开头：支持多种格式
        // 1. 例X、例X.、例X、等格式（优先匹配，因为更常见）
        // 2. 数字 + 点/顿号/空格 + 内容
        // 3. 第X题、题目X等格式
        let questionMatch = line.match(/^例\s*(\d+)[.、]?\s*(.+)$/) ||  // 例23、例23.、例23、等
                           line.match(/^例\s*(\d+)(.+)$/) ||              // 例23内容（无标点）
                           line.match(/^(?:第\s*)?(\d+)[.、]\s*(.+)$/) || // 数字 + 点/顿号 + 空格 + 内容
                           line.match(/^(?:第\s*)?(\d+)[.、](.+)$/) ||     // 数字 + 点/顿号 + 内容
                           line.match(/^(\d+)\s+([^A-Z].+)$/) ||          // 数字 + 空格 + 非字母开头的内容
                           line.match(/^(\d+)[.、]?\s*(.+)$/) ||           // 数字 + 可选标点 + 空格 + 内容
                           line.match(/^(\d+)(.+)$/)                      // 数字直接跟内容
        
        // 如果匹配成功，检查内容是否合理（避免误匹配）
        if (questionMatch && questionMatch[2]) {
          const content = questionMatch[2].trim()
          
          // 排除选项格式的内容（避免将选项误识别为题目）
          // 如果内容看起来像选项（以数字开头，包含×、/、-等数学符号，且较短），可能是选项
          if (content.match(/^\d+[.、]?\s*[\d×/()\-]/) && 
              content.length < 100 &&
              !content.match(/[。，、]/)) {
            // 这可能是选项，不是题目
            questionMatch = null
          }
          // 内容长度要合理，且不是纯数字或纯符号
          else if (content.length < 3 || /^[\d\s.、]+$/.test(content)) {
            questionMatch = null
          }
          // 如果内容看起来像数学公式（大量×、/、-、()），且没有中文，可能是选项
          else if (content.match(/^[\d\s×/()\-\.]+$/) && 
                   content.length < 150 &&
                   !content.match(/[\u4e00-\u9fa5]/)) {
            // 可能是选项，不是题目
            questionMatch = null
          }
        }
        
        if (questionMatch && questionMatch[2] && questionMatch[2].trim().length > 2) {
          // 保存上一题
          if (currentQuestion) {
            questions.push(currentQuestion)
          }
          
          currentQuestion = {
            id: questionMatch[1],
            content: questionMatch[2].trim(),
            options: [],
            answer: '',
            userAnswer: ''
          }
        } 
        // 匹配选项：支持 A. A、 A) (A) 等格式
        else if (currentQuestion) {
          // 先检查是否是答案行
          const answerMatch = line.match(/答案[:：]\s*([A-Z])/i) ||
                             line.match(/正确答案[:：]\s*([A-Z])/i) ||
                             line.match(/答案\s*[：:]\s*([A-Z])/i) ||
                             line.match(/^答案\s*([A-Z])$/i)
          
          if (answerMatch) {
            currentQuestion.answer = answerMatch[1].toUpperCase()
          }
          // 检查是否是选项：A. B. C. D. 等格式
          else {
            // 更精确的选项匹配：A. 或 A、或 A) 或 (A) 开头，后面跟内容
            // 也支持数字开头的选项（如 1. 067x... 可能是选项A的内容）
            const optionMatch = line.match(/^([A-Z])[.、)\s]+\s*(.+)$/) ||
                               line.match(/^\(([A-Z])\)\s*(.+)$/) ||
                               line.match(/^([A-Z])\s+(.+)$/) ||
                               line.match(/^([A-Z])[.、](.+)$/) ||  // A.内容 或 A、内容
                               // 处理OCR识别错误：数字开头的选项（如 1. 067x... 应该是 A. 1.067x...）
                               (line.match(/^(\d+)[.、]\s*(.+)$/) && 
                                line.match(/^[\d\s×/()\-\.]+$/) && 
                                line.length < 150 &&
                                currentQuestion.options.length < 4)  // 如果当前题目选项少于4个，可能是选项
            
            if (optionMatch && optionMatch[2] && optionMatch[2].trim().length > 0) {
              let optionKey = optionMatch[1]
              let optionValue = optionMatch[2].trim()
              
              // 如果匹配的是数字开头的选项，转换为字母选项
              if (/^\d+$/.test(optionKey)) {
                const optionIndex = parseInt(optionKey) - 1
                if (optionIndex >= 0 && optionIndex < 4) {
                  optionKey = String.fromCharCode(65 + optionIndex) // A, B, C, D
                  // 如果选项值以数字开头，保留它（可能是公式的一部分）
                }
              }
              
              // 选项验证：长度合理，不是题目编号
              if (optionValue.length > 0 && 
                  optionValue.length < 500 &&  // 增加长度限制，支持长公式
                  !optionValue.match(/^例\d+/) &&
                  !optionValue.match(/^第\s*\d+/) &&
                  !optionValue.match(/^【例/)) {  // 排除【例X】格式
                // 检查是否已存在相同key的选项
                const existingOption = currentQuestion.options.find(opt => opt.key === optionKey)
                if (!existingOption) {
                  currentQuestion.options.push({
                    key: optionKey,
                    value: optionValue
                  })
                  console.log(`  识别到选项 ${optionKey}: ${optionValue.substring(0, 80)}`)
                }
              }
            }
            // 如果当前行不是选项也不是答案，可能是题目内容的延续
            else if (line.length > 3 && 
                     !line.match(/^\d+[.、]/) && 
                     !line.match(/^例\s*\d+/) &&
                     !line.match(/^第\s*\d+/) &&
                     !line.match(/^[A-Z][.、)]/) &&
                     currentQuestion.content) {
              // 检查是否是题目内容的延续（不是新题目，且还没有选项）
              // 如果已经有选项了，说明题目内容已经结束，不再追加
              if (!line.match(/^答案/) && 
                  currentQuestion.options.length === 0 &&
                  !line.match(/^[A-Z]\s*[.、)]/)) {
                // 追加到题目内容
                currentQuestion.content += ' ' + line
              }
            }
          }
        }
      })
      
      // 保存最后一题
      if (currentQuestion) {
        questions.push(currentQuestion)
      }
      
      this.questions = questions
      console.log('========== 题目解析完成 ==========')
      console.log('共解析出', questions.length, '道题目')
      if (questions.length > 0) {
        console.log('第一题示例:')
        console.log(JSON.stringify(questions[0], null, 2))
        if (questions.length > 1) {
          console.log('第二题示例:')
          console.log(JSON.stringify(questions[1], null, 2))
        }
      } else {
        console.warn('⚠️ 未解析出任何题目')
        console.log('建议检查:')
        console.log('1. PDF文本是否正确提取')
        console.log('2. 题目格式是否符合要求（如: 1. 题目内容）')
        console.log('3. 选项格式是否符合要求（如: A. 选项内容）')
      }
      console.log('================================')
    },
    // 记录用户答案
    setUserAnswer(questionId, answer) {
      this.answers[questionId] = answer
      const question = this.questions.find(q => q.id === questionId)
      if (question) question.userAnswer = answer
    },
    // 切换题目
    changeQuestionIndex(index) {
      if (index >= 0 && index < this.questions.length) {
        this.currentQuestionIndex = index
      }
    },
    // 重置刷题状态
    resetPractice() {
      this.currentQuestionIndex = 0
      this.answers = {}
      this.questions.forEach(q => q.userAnswer = '')
    },
    // 清空题库
    clearBank() {
      this.pdfText = ''
      this.questions = []
      this.resetPractice()
    }
  },
  getters: {
    // 当前题目
    currentQuestion(state) {
      return state.questions[state.currentQuestionIndex] || null
    },
    // 答题正确率
    correctRate(state) {
      if (state.questions.length === 0) return 0
      let correctCount = 0
      state.questions.forEach(q => {
        if (q.userAnswer && q.userAnswer === q.answer) correctCount++
      })
      return (correctCount / state.questions.length * 100).toFixed(2)
    },
    // 已答题数
    answeredCount(state) {
      return Object.keys(state.answers).length
    }
  }
})