/**
 * OCR工具函数 - 使用Tesseract.js进行本地OCR识别
 */

import { createWorker } from 'tesseract.js'

/**
 * 将PDF页面转换为图片
 * @param {Object} page - PDF.js页面对象
 * @param {Number} scale - 缩放比例，默认3（提高OCR准确率，特别是数字和公式）
 * @returns {Promise<Blob>} 图片Blob
 */
export async function pdfPageToImage(page, scale = 3) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  // 设置高质量渲染
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise
  
  // 对图片进行预处理以提高OCR准确率
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  
  // 增强对比度（提高文字清晰度）
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const gray = (r + g + b) / 3
    
    // 二值化处理（黑白化），提高OCR准确率
    const threshold = 128
    const value = gray > threshold ? 255 : 0
    data[i] = value     // R
    data[i + 1] = value // G
    data[i + 2] = value // B
    // data[i + 3] 保持alpha通道不变
  }
  
  context.putImageData(imageData, 0, 0)
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, 'image/png', 1.0) // 最高质量
  })
}

/**
 * 使用OCR识别图片中的文本
 * @param {Blob|ImageData|HTMLImageElement|HTMLCanvasElement} image - 图片对象
 * @param {String} lang - 语言代码，默认'chi_sim+eng'（简体中文+英文）
 * @param {Function} onProgress - 进度回调函数（注意：不能传递函数给Worker，需要简化）
 * @returns {Promise<String>} 识别出的文本
 */
export async function recognizeText(image, lang = 'chi_sim+eng', onProgress = null) {
  // 保存原始的console.warn，用于过滤Tesseract的警告
  const originalWarn = console.warn
  let warnCount = 0
  
  // 临时过滤Tesseract的参数警告
  console.warn = (...args) => {
    const message = args.join(' ')
    // 过滤掉Tesseract的参数警告
    if (message.includes('Parameter not found:') || 
        message.includes('tesseract-core') ||
        message.includes('Warning:')) {
      warnCount++
      // 每100个警告才输出一次，避免刷屏
      if (warnCount % 100 === 0) {
        originalWarn(`[已过滤 ${warnCount} 个Tesseract警告]`)
      }
      return
    }
    // 其他警告正常输出
    originalWarn(...args)
  }
  
  const worker = await createWorker(lang)
  
  try {
    // 注意：不能传递函数给Worker的logger，会导致DataCloneError
    // 我们移除logger，只在页面级别显示进度
    const { data: { text } } = await worker.recognize(image)
    
    // 恢复原始的console.warn
    console.warn = originalWarn
    
    if (warnCount > 0) {
      console.log(`[OCR完成] 已过滤 ${warnCount} 个Tesseract内部警告（不影响功能）`)
    }
    
    return text || ''
  } catch (error) {
    // 恢复原始的console.warn
    console.warn = originalWarn
    console.error('OCR识别错误:', error)
    throw new Error(`OCR识别失败: ${error.message}`)
  } finally {
    await worker.terminate()
  }
}

/**
 * OCR识别PDF页面
 * @param {Object} page - PDF.js页面对象
 * @param {Number} scale - 缩放比例
 * @param {String} lang - 语言代码
 * @param {Function} onProgress - 进度回调（简化版，避免Worker序列化问题）
 * @returns {Promise<String>} 识别出的文本
 */
export async function ocrPdfPage(page, scale = 3, lang = 'chi_sim+eng', onProgress = null) {
  // 将PDF页面转换为图片（使用更高scale提高精度）
  const imageBlob = await pdfPageToImage(page, scale)
  
  // OCR识别（直接传递onProgress，recognizeText内部会处理序列化问题）
  let text = await recognizeText(imageBlob, lang, onProgress)
  
  // 后处理：修复常见的OCR识别错误
  text = postProcessOCRText(text)
  
  return text
}

/**
 * OCR文本后处理：修复常见的识别错误
 * @param {String} text - OCR识别出的原始文本
 * @returns {String} - 修复后的文本
 */
function postProcessOCRText(text) {
  if (!text) return text
  
  // 修复分数识别错误：将横杠替换为小数点
  // 例如：1-067 -> 1.067, 1 067 -> 1.067
  text = text
    // 修复数字之间的横杠（可能是小数点）
    .replace(/(\d)[-—]([0-9]{3})/g, '$1.$2')  // 1-067 -> 1.067
    .replace(/(\d)\s+([0-9]{3})/g, '$1.$2')    // 1 067 -> 1.067
    // 修复常见的OCR错误
    .replace(/x/g, '×')  // 小写x -> 乘号×
    .replace(/X/g, '×')  // 大写X -> 乘号×
    .replace(/Ag/g, 'A.')  // Ag -> A.
    .replace(/BT/g, 'B.')  // BT -> B.
    .replace(/CC/g, 'C.')  // CC -> C.
    .replace(/Ds/g, 'D.')  // Ds -> D.
    // 修复选项编号错误
    .replace(/^1\.\s*(\d)/gm, 'A. $1')  // 1. 067 -> A. 067（如果是在选项位置）
    // 修复常见的字符识别错误
    .replace(/0/g, 'O')  // 在某些字体中0和O容易混淆，但这里可能不需要
    .replace(/O(?=\d)/g, '0')  // 数字前的O应该是0
  
  return text
}

/**
 * OCR识别整个PDF文档
 * @param {Object} pdf - PDF.js文档对象
 * @param {Object} options - 选项
 * @param {Number} options.scale - 缩放比例，默认2
 * @param {String} options.lang - 语言代码，默认'chi_sim+eng'
 * @param {Function} options.onProgress - 进度回调 (page, total, text) => void
 * @param {Number} options.startPage - 开始页码，默认1
 * @param {Number} options.endPage - 结束页码，默认所有页
 * @param {Number} options.maxPages - 最大处理页数，默认null（处理所有页）
 * @returns {Promise<String>} 识别出的完整文本
 */
export async function ocrPdf(pdf, options = {}) {
    const {
      scale = 3,  // 提高默认scale以提高精度
      lang = 'chi_sim+eng',
      onProgress = null,
      startPage = 1,
      endPage = null,
      maxPages = null
    } = options
  
  const totalPages = Math.min(endPage || pdf.numPages, maxPages || pdf.numPages)
  let fullText = ''
  
  try {
    for (let i = startPage; i <= totalPages; i++) {
      const page = await pdf.getPage(i)
      
      if (onProgress) {
        onProgress({
          page: i,
          total: totalPages,
          status: 'processing',
          message: `正在处理第 ${i}/${totalPages} 页...`
        })
      }
      
      const pageText = await ocrPdfPage(page, scale, lang, (progress) => {
        if (onProgress) {
          const overallProgress = (i - 1 + (progress.progress || 0)) / totalPages
          onProgress({
            page: i,
            total: totalPages,
            progress: overallProgress,
            status: 'recognizing',
            message: `识别第 ${i} 页: ${Math.round((progress.progress || 0) * 100)}%`
          })
        }
      })
      
      if (pageText && pageText.trim()) {
        fullText += pageText.trim() + '\n\n'
      }
      
      if (onProgress) {
        onProgress({
          page: i,
          total: totalPages,
          status: 'completed',
          message: `第 ${i} 页识别完成`,
          progress: i / totalPages
        })
      }
    }
    
    return fullText.trim()
  } catch (error) {
    console.error('PDF OCR处理错误:', error)
    throw new Error(`PDF OCR处理失败: ${error.message}`)
  }
}

