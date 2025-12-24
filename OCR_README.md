# 本地OCR功能说明

## 功能概述

项目已集成本地OCR功能，使用 **Tesseract.js** 在浏览器端直接识别扫描件PDF，无需后端服务。

## 实现方案

### 方案一：浏览器端OCR（已实现）✅

**技术栈：**
- Tesseract.js - 浏览器端OCR引擎
- PDF.js - PDF页面渲染为图片
- Canvas API - 图片处理

**优点：**
- ✅ 无需后端服务器
- ✅ 数据完全本地处理，隐私安全
- ✅ 部署简单

**缺点：**
- ⚠️ 首次使用需要下载语言包（约10-20MB）
- ⚠️ 处理速度较慢（每页约5-15秒）
- ⚠️ 占用浏览器内存较大

**使用方法：**
1. 上传扫描件PDF
2. 系统检测到扫描件后，会显示"开始OCR识别"按钮
3. 点击按钮开始识别
4. 等待识别完成（显示进度条）
5. 识别完成后自动解析题目

## 性能优化建议

### 1. 限制处理页数
对于大型PDF（如300+页），建议：
- 分批处理（每次10-20页）
- 或只处理包含题目的页面

### 2. 调整识别参数
在 `src/utils/ocr.js` 中可以调整：
- `scale`: 缩放比例（1-3），越大越准确但越慢
- `lang`: 语言代码，只选择需要的语言可加快速度

### 3. 使用Web Worker（可选）
可以创建Web Worker来避免阻塞主线程。

## 替代方案

### 方案二：Node.js后端OCR（推荐用于生产环境）

如果需要更好的性能，可以添加后端服务：

```bash
# 安装依赖
npm install express multer tesseract.js pdf-parse
```

**后端示例（server.js）：**
```javascript
import express from 'express'
import multer from 'multer'
import { createWorker } from 'tesseract.js'
import pdf from 'pdf-parse'

const app = express()
const upload = multer({ dest: 'uploads/' })

app.post('/api/ocr-pdf', upload.single('pdf'), async (req, res) => {
  // PDF处理逻辑
  // OCR识别逻辑
  // 返回识别结果
})
```

**优点：**
- ✅ 性能更好
- ✅ 可以使用更强大的OCR引擎
- ✅ 可以缓存语言包

**缺点：**
- ❌ 需要部署后端服务
- ❌ 增加服务器成本

### 方案三：使用云OCR服务

- Google Cloud Vision API
- Azure Computer Vision
- 百度OCR API
- 腾讯OCR API

## 语言包说明

Tesseract.js支持多种语言，常用语言代码：
- `chi_sim` - 简体中文
- `chi_tra` - 繁体中文
- `eng` - 英文
- `chi_sim+eng` - 简体中文+英文（默认）

首次使用时，Tesseract.js会自动下载语言包到浏览器缓存。

## 故障排除

### 1. OCR识别速度慢
- 正常现象，每页需要5-15秒
- 可以降低scale参数（但会降低准确率）

### 2. 识别准确率低
- 提高scale参数（2-3）
- 确保PDF图片清晰
- 检查语言设置是否正确

### 3. 浏览器崩溃
- 减少同时处理的页数
- 使用Web Worker
- 升级浏览器内存

### 4. 语言包下载失败
- 检查网络连接
- 尝试手动下载语言包
- 使用CDN镜像

## 开发建议

1. **首次加载优化**：可以预加载语言包
2. **进度显示**：已实现进度条，可以进一步优化UI
3. **错误处理**：已实现基本错误处理，可以添加重试机制
4. **缓存策略**：可以缓存识别结果

## 相关资源

- [Tesseract.js文档](https://tesseract.projectnaptha.com/)
- [PDF.js文档](https://mozilla.github.io/pdf.js/)
- [Tesseract语言包](https://github.com/tesseract-ocr/tessdata)

