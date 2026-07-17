# 第二次回答

一个帮助用户重新回到真实对话、选择自己要说的话，并与 AI 模拟的“她”连续练习对话的网页应用。

## 已包含

- 8 步固定问卷：关系、场景、对方的话、原回答、感受、核心意图、期待与边界、语气与长度
- 3 个可编辑的开场草稿：核心表达、更温和、边界更清楚
- 问卷结束后进入聊天框，由用户逐句决定自己要说什么
- AI 根据记忆背景和完整对话记录，逐轮生成“她的一种可能回复”
- 明确标注模拟回复不代表真实人物的想法
- 不在浏览器保存问卷内容，一键清空本次记忆
- 服务端调用 OpenAI Responses API，并使用结构化 JSON 输出
- 未配置 API Key 时自动使用本地草稿模式，方便完整体验界面

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .env.local
npm run dev
```

在 `.env.local` 中设置：

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5-mini
```

不要将 `.env.local` 提交到版本库。AI 请求使用 `store: false`，应用自身也不持久化问卷内容。

## 验证

```bash
npm test
```
