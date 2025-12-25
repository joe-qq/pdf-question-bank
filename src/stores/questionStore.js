//状态管理
import { defineStore } from "pinia";

export const useQuestionStore = defineStore("question", {
  state: () => ({
    // 原始PDF文本
    pdfText: "",
    // 答案PDF文本
    answerPdfText: "",
    // 解析后的题目列表
    questions: [],
    // 当前刷题进度
    currentQuestionIndex: 0,
    // 答题记录
    answers: {},
  }),
  actions: {
    // 设置PDF文本
    setPdfText(text) {
      this.pdfText = text;
      this.parseQuestions();
    },
    // 设置答案PDF文本
    setAnswerPdfText(text) {
      this.answerPdfText = text;
      this.parseAnswers();
    },
    // 解析题目（增强版，支持多种格式）
    parseQuestions() {
      if (!this.pdfText) return;

      // 清理文本：移除多余空格，统一换行符
      let text = this.pdfText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n") // 多个连续换行合并为两个
        .trim();

      // 如果文本很少换行，尝试按数字分割（处理所有内容在一行的情况）
      let lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // 如果过滤后行数很少，可能是文本格式问题，尝试更宽松的过滤
      if (lines.length < 5 && text.length > 100) {
        console.log("⚠️ 过滤后行数很少，尝试保留更多内容...");
        // 只过滤完全空白的行
        lines = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0 || line.match(/\S/));
      }

      // 如果行数很少但文本很长，可能是所有内容在一行，尝试按题目分割
      if (lines.length < 10 && text.length > 100) {
        console.log("⚠️ 检测到文本可能在一行，尝试按题目分割...");
        // 改进的分割方法：按题目编号分割
        // 匹配模式：数字 + 点/顿号 + 空格 + 内容（直到下一个数字开头）
        const questionPattern = /(\d+[.、]\s+)(.+?)(?=\d+[.、]\s+|$)/g;
        const matches = [];
        let match;

        while ((match = questionPattern.exec(text)) !== null) {
          const questionNum = match[1].trim();
          const questionContent = match[2].trim();
          if (questionContent.length > 3) {
            matches.push(questionNum + questionContent);
          }
        }

        if (matches.length > 0) {
          console.log("成功分割，得到", matches.length, "个可能的题目");
          return this.parseQuestionsFromLines(matches);
        }

        // 如果上面的方法不行，尝试简单的按数字分割
        const simplePattern = /(\d+[.、]\s*)/g;
        const parts = text.split(simplePattern);
        if (parts.length > 3) {
          console.log(
            "使用简单分割，得到",
            Math.floor(parts.length / 2),
            "个可能的题目段"
          );
          const newLines = [];
          for (let i = 0; i < parts.length - 1; i += 2) {
            if (parts[i] && parts[i + 1]) {
              const combined = (parts[i] + parts[i + 1]).trim();
              if (combined.length > 3) {
                newLines.push(combined);
              }
            }
          }
          if (newLines.length > 0) {
            return this.parseQuestionsFromLines(newLines);
          }
        }
      }

      return this.parseQuestionsFromLines(lines);
    },
    // 从行数组解析题目
    parseQuestionsFromLines(lines) {
      const questions = [];
      let currentQuestion = null;

      console.log("========== 题目解析开始 ==========");
      console.log("总行数:", lines.length);
      console.log("原始文本长度:", this.pdfText.length);
      // 计算清理后的文本长度（所有行加起来）
      const cleanedTextLength = lines.join("\n").length;
      console.log("清理后文本长度（估算）:", cleanedTextLength);

      // 显示非空行的内容
      const nonEmptyLines = lines.filter((line) => line.length > 0);
      console.log("非空行数:", nonEmptyLines.length);

      if (nonEmptyLines.length > 0) {
        console.log("前20个非空行内容:");
        nonEmptyLines.slice(0, 20).forEach((line, idx) => {
          console.log(`  ${idx + 1}: "${line}"`);
        });
      } else {
        console.warn("⚠️ 没有找到非空行！");
        console.log("原始文本前500字符:");
        console.log(this.pdfText.substring(0, 500));
        console.log("原始文本（显示不可见字符）:");
        console.log(JSON.stringify(this.pdfText.substring(0, 200)));
      }

      // 尝试查找可能的题目模式
      console.log("查找题目模式...");
      // 支持多种题目格式：数字开头、例X、第X题等
      const possibleQuestions = lines.filter(
        (line) =>
          /^\d+[.、\s]/.test(line) || // 数字开头
          /^例\d+/.test(line) || // 例X格式
          /^第\s*\d+/.test(line) // 第X题格式
      );
      console.log("可能的题目行数:", possibleQuestions.length);
      if (possibleQuestions.length > 0) {
        console.log("前10个可能的题目:");
        possibleQuestions.slice(0, 10).forEach((line, idx) => {
          console.log(`  ${idx + 1}: "${line}"`);
        });
      } else {
        console.warn("⚠️ 未找到标准题目格式");
        // 尝试查找所有包含数字的行
        const linesWithNumbers = lines.filter((line) => /\d+/.test(line));
        console.log("包含数字的行数:", linesWithNumbers.length);
        if (linesWithNumbers.length > 0) {
          console.log("前10个包含数字的行:");
          linesWithNumbers.slice(0, 10).forEach((line, idx) => {
            console.log(`  ${idx + 1}: "${line}"`);
          });
        }
      }

      lines.forEach((line, index) => {
        // 跳过空行和过短的行
        if (line.length < 2) return;

        // 匹配题目开头：支持多种格式
        // 1. 例X、例X.、例X、等格式（优先匹配，因为更常见）
        // 2. 数字 + 点/顿号/空格 + 内容
        // 3. 第X题、题目X等格式
        let questionMatch =
          line.match(/^例\s*(\d+)[.、]?\s*(.+)$/) || // 例23、例23.、例23、等
          line.match(/^例\s*(\d+)(.+)$/) || // 例23内容（无标点）
          line.match(/^(?:第\s*)?(\d+)[.、]\s*(.+)$/) || // 数字 + 点/顿号 + 空格 + 内容
          line.match(/^(?:第\s*)?(\d+)[.、](.+)$/) || // 数字 + 点/顿号 + 内容
          line.match(/^(\d+)\s+([^A-Z].+)$/) || // 数字 + 空格 + 非字母开头的内容
          line.match(/^(\d+)[.、]?\s*(.+)$/) || // 数字 + 可选标点 + 空格 + 内容
          line.match(/^(\d+)(.+)$/); // 数字直接跟内容

        // 如果匹配成功，检查内容是否合理（避免误匹配）
        if (questionMatch && questionMatch[2]) {
          const content = questionMatch[2].trim();

          // 排除选项格式的内容（避免将选项误识别为题目）
          // 如果内容看起来像选项（以数字开头，包含×、/、-等数学符号，且较短），可能是选项
          if (
            content.match(/^\d+[.、]?\s*[\d×/()\-]/) &&
            content.length < 100 &&
            !content.match(/[。，、]/)
          ) {
            // 这可能是选项，不是题目
            questionMatch = null;
          }
          // 内容长度要合理，且不是纯数字或纯符号
          else if (content.length < 3 || /^[\d\s.、]+$/.test(content)) {
            questionMatch = null;
          }
          // 如果内容看起来像数学公式（大量×、/、-、()），且没有中文，可能是选项
          else if (
            content.match(/^[\d\s×/()\-\.]+$/) &&
            content.length < 150 &&
            !content.match(/[\u4e00-\u9fa5]/)
          ) {
            // 可能是选项，不是题目
            questionMatch = null;
          }
        }

        if (
          questionMatch &&
          questionMatch[2] &&
          questionMatch[2].trim().length > 2
        ) {
          // 保存上一题（只保存有选项的题目）
          if (currentQuestion && currentQuestion.options.length > 0) {
            questions.push(currentQuestion);
          } else if (currentQuestion) {
            console.log(`⚠️ 题目 ${currentQuestion.id} 没有选项，已跳过`);
          }

          currentQuestion = {
            id: questionMatch[1],
            content: questionMatch[2].trim(),
            options: [],
            answer: "",
            userAnswer: "",
          };
        }
        // 匹配选项：支持 A. A、 A) (A) 等格式，以及一行多个选项 A.XXX B.XXX C.XXX D.XXX
        else if (currentQuestion) {
          // 先检查是否是答案行
          const answerMatch =
            line.match(/答案[:：]\s*([A-Z])/i) ||
            line.match(/正确答案[:：]\s*([A-Z])/i) ||
            line.match(/答案\s*[：:]\s*([A-Z])/i) ||
            line.match(/^答案\s*([A-Z])$/i);

          if (answerMatch) {
            currentQuestion.answer = answerMatch[1].toUpperCase();
          }
          // 检查是否是选项：支持一行多个选项 A.XXX B.XXX C.XXX D.XXX
          else {
            // 先尝试匹配一行中的多个选项（如 A.XXX B.XXX C.XXX D.XXX）
            // 匹配模式：字母 + 标点 + 内容，直到下一个字母+标点或行尾
            // 限制选项字母范围：A-Z，但排除容易混淆的字母（O、I、L等，这些可能是OCR识别错误）
            // 通常选项是A-D，但为了兼容性，允许A-Z，但需要更严格的验证
            const multiOptionPattern =
              /([A-Z])[.、)\s]+\s*([^A-Z]+?)(?=\s+[A-Z][.、)\s]+\s*|$)/g;
            let match;
            let foundOptions = false;

            // 重置正则表达式的lastIndex，避免重复匹配问题
            multiOptionPattern.lastIndex = 0;

            while ((match = multiOptionPattern.exec(line)) !== null) {
              const optionKey = match[1];
              let optionValue = match[2].trim();

              // 清理选项值：移除末尾可能的空格和标点
              optionValue = optionValue.replace(/\s+$/, "");

              // 检查匹配位置前面的字符，如果前面是数字，很可能是OCR误识别（如"4O"应该是"40"）
              const matchIndex = match.index;
              const beforeMatch =
                matchIndex > 0
                  ? line.substring(Math.max(0, matchIndex - 3), matchIndex)
                  : "";
              // 检查前面是否有数字+字母O的模式（如"4O"、"40"被OCR识别为"4O"）
              const hasNumberBeforeO = /[\d]\s*O[.、)\s]/.test(
                beforeMatch + match[0]
              );

              // 更严格的选项验证
              // 1. 排除容易混淆的字母（O、I、L等，这些可能是OCR识别错误，如O可能是0）
              // 2. 排除前面有数字的字母O（如"4O"应该是"40"，是OCR误识别）
              // 3. 选项内容应该有合理的长度（至少3个字符，避免匹配"亿年"这样的短文本）
              // 4. 选项内容不能只是数字+单位（如"4.4亿年"被OCR识别为"O. 亿年"）
              // 5. 选项内容应该包含一定量的文字，不能太短
              const isConfusingLetter = ["O", "I", "L"].includes(optionKey);
              const isOcRError = optionKey === "O" && hasNumberBeforeO; // O前面有数字，可能是OCR误识别
              const isTooShort = optionValue.length < 3;
              const isOnlyNumberAndUnit =
                /^[\d.\s]*[年月日时分秒个]+[。，、]?$/.test(optionValue);
              const isOnlyNumber = /^[\d.\s]+$/.test(optionValue);

              // 选项验证：长度合理，不是题目编号，不是容易混淆的字母，内容合理
              if (
                optionValue.length > 0 &&
                optionValue.length < 500 &&
                !optionValue.match(/^例\d+/) &&
                !optionValue.match(/^第\s*\d+/) &&
                !optionValue.match(/^【例/) &&
                !isConfusingLetter && // 排除容易混淆的字母
                !isOcRError && // 排除OCR误识别（如"4O"应该是"40"）
                !isTooShort && // 选项内容至少3个字符
                !isOnlyNumberAndUnit && // 排除"亿年"这样的数字+单位
                !isOnlyNumber // 排除纯数字
              ) {
                // 检查是否已存在相同key的选项
                const existingOption = currentQuestion.options.find(
                  (opt) => opt.key === optionKey
                );
                if (!existingOption) {
                  currentQuestion.options.push({
                    key: optionKey,
                    value: optionValue,
                  });
                  console.log(
                    `  识别到选项 ${optionKey}: ${optionValue.substring(0, 80)}`
                  );
                  foundOptions = true;
                }
              } else {
                // 记录被过滤的选项，便于调试
                if (
                  isConfusingLetter ||
                  isOcRError ||
                  isTooShort ||
                  isOnlyNumberAndUnit ||
                  isOnlyNumber
                ) {
                  console.log(
                    `  ⚠️ 过滤掉可能的误识别选项 ${optionKey}: "${optionValue}" (原因: ${
                      isOcRError
                        ? "OCR误识别（前面有数字，如'4O'应该是'40'）"
                        : isConfusingLetter
                        ? "容易混淆的字母"
                        : isTooShort
                        ? "内容过短"
                        : isOnlyNumberAndUnit
                        ? "仅数字+单位"
                        : "纯数字"
                    })`
                  );
                }
              }
            }

            // 如果没有匹配到多个选项，尝试匹配单个选项（原有逻辑）
            let optionMatch = null;
            if (!foundOptions) {
              optionMatch =
                line.match(/^([A-Z])[.、)\s]+\s*(.+)$/) ||
                line.match(/^\(([A-Z])\)\s*(.+)$/) ||
                line.match(/^([A-Z])\s+(.+)$/) ||
                line.match(/^([A-Z])[.、](.+)$/) || // A.内容 或 A、内容
                // 处理OCR识别错误：数字开头的选项（如 1. 067x... 应该是 A. 1.067x...）
                (line.match(/^(\d+)[.、]\s*(.+)$/) &&
                  line.match(/^[\d\s×/()\-\.]+$/) &&
                  line.length < 150 &&
                  currentQuestion.options.length < 4); // 如果当前题目选项少于4个，可能是选项

              if (
                optionMatch &&
                optionMatch[2] &&
                optionMatch[2].trim().length > 0
              ) {
                let optionKey = optionMatch[1];
                let optionValue = optionMatch[2].trim();

                // 如果匹配的是数字开头的选项，转换为字母选项
                if (/^\d+$/.test(optionKey)) {
                  const optionIndex = parseInt(optionKey) - 1;
                  if (optionIndex >= 0 && optionIndex < 4) {
                    optionKey = String.fromCharCode(65 + optionIndex); // A, B, C, D
                  }
                }

                // 检查匹配位置前面的字符，如果前面是数字，很可能是OCR误识别（如"4O"应该是"40"）
                const matchIndex = optionMatch.index;
                const beforeMatch =
                  matchIndex > 0
                    ? line.substring(Math.max(0, matchIndex - 3), matchIndex)
                    : "";
                // 检查前面是否有数字+字母O的模式（如"4O"、"40"被OCR识别为"4O"）
                const hasNumberBeforeO = /[\d]\s*O[.、)\s]/.test(
                  beforeMatch + optionMatch[0]
                );

                // 更严格的选项验证（与多选项匹配保持一致）
                const isConfusingLetter = ["O", "I", "L"].includes(optionKey);
                const isOcRError = optionKey === "O" && hasNumberBeforeO; // O前面有数字，可能是OCR误识别
                const isTooShort = optionValue.length < 3;
                const isOnlyNumberAndUnit =
                  /^[\d.\s]*[年月日时分秒个]+[。，、]?$/.test(optionValue);
                const isOnlyNumber = /^[\d.\s]+$/.test(optionValue);

                // 选项验证：长度合理，不是题目编号，不是容易混淆的字母，内容合理
                if (
                  optionValue.length > 0 &&
                  optionValue.length < 500 &&
                  !optionValue.match(/^例\d+/) &&
                  !optionValue.match(/^第\s*\d+/) &&
                  !optionValue.match(/^【例/) &&
                  !isConfusingLetter && // 排除容易混淆的字母
                  !isOcRError && // 排除OCR误识别（如"4O"应该是"40"）
                  !isTooShort && // 选项内容至少3个字符
                  !isOnlyNumberAndUnit && // 排除"亿年"这样的数字+单位
                  !isOnlyNumber // 排除纯数字
                ) {
                  // 检查是否已存在相同key的选项
                  const existingOption = currentQuestion.options.find(
                    (opt) => opt.key === optionKey
                  );
                  if (!existingOption) {
                    currentQuestion.options.push({
                      key: optionKey,
                      value: optionValue,
                    });
                    console.log(
                      `  识别到选项 ${optionKey}: ${optionValue.substring(
                        0,
                        80
                      )}`
                    );
                  }
                } else {
                  // 记录被过滤的选项，便于调试
                  if (
                    isConfusingLetter ||
                    isOcRError ||
                    isTooShort ||
                    isOnlyNumberAndUnit ||
                    isOnlyNumber
                  ) {
                    console.log(
                      `  ⚠️ 过滤掉可能的误识别选项 ${optionKey}: "${optionValue}" (原因: ${
                        isOcRError
                          ? "OCR误识别（前面有数字，如'4O'应该是'40'）"
                          : isConfusingLetter
                          ? "容易混淆的字母"
                          : isTooShort
                          ? "内容过短"
                          : isOnlyNumberAndUnit
                          ? "仅数字+单位"
                          : "纯数字"
                      })`
                    );
                  }
                }
              }
            }

            // 如果当前行不是选项也不是答案，可能是题目内容的延续
            if (
              !foundOptions &&
              !optionMatch &&
              line.length > 3 &&
              !line.match(/^\d+[.、]/) &&
              !line.match(/^例\s*\d+/) &&
              !line.match(/^第\s*\d+/) &&
              !line.match(/^[A-Z][.、)]/) &&
              currentQuestion.content
            ) {
              // 检查是否是题目内容的延续（不是新题目，且还没有选项）
              // 如果已经有选项了，说明题目内容已经结束，不再追加
              if (
                !line.match(/^答案/) &&
                currentQuestion.options.length === 0 &&
                !line.match(/^[A-Z]\s*[.、)]/)
              ) {
                // 追加到题目内容
                currentQuestion.content += " " + line;
              }
            }
          }
        }
      });

      // 保存最后一题（只保存有选项的题目）
      if (currentQuestion && currentQuestion.options.length > 0) {
        questions.push(currentQuestion);
      } else if (currentQuestion) {
        console.log(`⚠️ 题目 ${currentQuestion.id} 没有选项，已跳过`);
      }

      this.questions = questions;
      console.log("========== 题目解析完成 ==========");
      console.log("共解析出", questions.length, "道题目");
      if (questions.length > 0) {
        console.log("第一题示例:");
        console.log(JSON.stringify(questions[0], null, 2));
        if (questions.length > 1) {
          console.log("第二题示例:");
          console.log(JSON.stringify(questions[1], null, 2));
        }
      } else {
        console.warn("⚠️ 未解析出任何题目");
        console.log("建议检查:");
        console.log("1. PDF文本是否正确提取");
        console.log("2. 题目格式是否符合要求（如: 1. 题目内容）");
        console.log("3. 选项格式是否符合要求（如: A. 选项内容）");
      }
      console.log("================================");
    },
    // 记录用户答案
    setUserAnswer(questionId, answer) {
      this.answers[questionId] = answer;
      const question = this.questions.find((q) => q.id === questionId);
      if (question) question.userAnswer = answer;
    },
    // 切换题目
    changeQuestionIndex(index) {
      if (index >= 0 && index < this.questions.length) {
        this.currentQuestionIndex = index;
      }
    },
    // 重置刷题状态
    resetPractice() {
      this.currentQuestionIndex = 0;
      this.answers = {};
      this.questions.forEach((q) => (q.userAnswer = ""));
    },
    // 解析答案（根据题号匹配题目）
    parseAnswers() {
      if (!this.answerPdfText || this.questions.length === 0) {
        console.warn("⚠️ 无法解析答案：答案文本为空或题目列表为空");
        return;
      }

      console.log("========== 开始解析答案 ==========");
      console.log("答案文本长度:", this.answerPdfText.length);

      // 清理文本：移除多余空格，统一换行符
      let text = this.answerPdfText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // 按行分割
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      console.log("答案文本行数:", lines.length);

      let matchedCount = 0;
      let unmatchedCount = 0;

      // 解析答案格式：支持多种格式
      // 1. 题号. 答案 (如: 1. A, 1. A, 1、A)
      // 2. 题号 答案 (如: 1 A, 1A)
      // 3. 题号：答案 (如: 1：A, 1:A)
      // 4. 题号答案 (如: 1A, 2B)
      lines.forEach((line) => {
        // 尝试匹配各种答案格式
        const patterns = [
          /^(\d+)[.、]\s*([A-Z])/i, // 1. A 或 1、A
          /^(\d+)\s+([A-Z])/i, // 1 A
          /^(\d+)[：:]\s*([A-Z])/i, // 1：A 或 1:A
          /^(\d+)([A-Z])/i, // 1A
        ];

        let matched = false;
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match) {
            const questionId = match[1];
            const answer = match[2].toUpperCase();

            // 查找对应的题目
            const question = this.questions.find((q) => q.id === questionId);
            if (question) {
              question.answer = answer;
              matchedCount++;
              console.log(`✓ 题目 ${questionId} 答案: ${answer}`);
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          // 尝试匹配更复杂的格式，如"第1题：A"、"题目1答案：A"等
          const complexPatterns = [
            /第\s*(\d+)\s*[题项][：:]\s*([A-Z])/i,
            /题目\s*(\d+)[：:]\s*([A-Z])/i,
            /题\s*(\d+)[：:]\s*([A-Z])/i,
          ];

          for (const pattern of complexPatterns) {
            const match = line.match(pattern);
            if (match) {
              const questionId = match[1];
              const answer = match[2].toUpperCase();

              const question = this.questions.find((q) => q.id === questionId);
              if (question) {
                question.answer = answer;
                matchedCount++;
                console.log(`✓ 题目 ${questionId} 答案: ${answer} (复杂格式)`);
                matched = true;
                break;
              }
            }
          }
        }

        if (!matched && line.length < 50) {
          // 记录未匹配的行（可能是答案格式不标准）
          unmatchedCount++;
          if (unmatchedCount <= 10) {
            console.log(`⚠️ 未匹配的答案行: "${line}"`);
          }
        }
      });

      console.log("========== 答案解析完成 ==========");
      console.log(`匹配成功: ${matchedCount} 个答案`);
      console.log(`未匹配: ${unmatchedCount} 行`);
      console.log(
        `有答案的题目数: ${this.questions.filter((q) => q.answer).length}`
      );
      console.log("================================");
    },
    // 清空题库
    clearBank() {
      this.pdfText = "";
      this.answerPdfText = "";
      this.questions = [];
      this.resetPractice();
    },
  },
  getters: {
    // 当前题目
    currentQuestion(state) {
      return state.questions[state.currentQuestionIndex] || null;
    },
    // 答题正确率
    correctRate(state) {
      if (state.questions.length === 0) return 0;
      let correctCount = 0;
      state.questions.forEach((q) => {
        if (q.userAnswer && q.userAnswer === q.answer) correctCount++;
      });
      return ((correctCount / state.questions.length) * 100).toFixed(2);
    },
    // 已答题数
    answeredCount(state) {
      return Object.keys(state.answers).length;
    },
  },
});
