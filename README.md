# 第二次回答

一个帮助用户重新回到真实对话、选择自己要说的话，并与 AI 模拟的“她”连续练习对话的网页应用。

## 已包含

- 10 步固定问卷：关系、场景、对方的话、她的说话方式、当时状态、原回答、感受、核心意图、期待与边界、语气与长度
- 记录她的口头禅、沟通意愿与冲突反应，让回复更接近具体人物而不是通用客服语气
- 3 个可编辑的开场草稿：核心表达、更温和、边界更清楚
- 问卷结束后进入聊天框，由用户逐句决定自己要说什么
- AI 根据人物声音、当时情绪、沟通意愿和完整对话记录，逐轮生成“她的一种可能回复”
- 她可以迟疑、误解、反驳、回避、冷淡或结束对话，不会默认每次都完美理解用户
- 明确标注模拟回复不代表真实人物的想法
- 不在浏览器保存问卷内容，一键清空本次记忆
- 服务端调用 OpenAI Responses API，并使用结构化 JSON 输出
- 未配置 API Key 时自动使用本地草稿模式，方便完整体验界面

## 本地运行

### 1. 环境要求

- Node.js `>=22.13.0`
- npm（安装 Node.js 时通常会一并安装）
- 首次安装依赖时需要连接 npm 软件源
- 使用真实 AI 回复时，运行环境需要能够访问 OpenAI API

先确认版本：

```bash
node --version
npm --version
```

如果找不到 `node` 或 `npm`，请先安装 Node.js。如果 npm 显示
`EBADENGINE`，请升级 Node.js 后再安装依赖。

当前 npm 脚本以 macOS/Linux 环境为主；Windows 用户建议通过 WSL
运行这些命令。

### 2. 获取项目

通过 SSH 克隆：

```bash
git clone git@github.com:RuiqiuZheng/SecondChance.git
cd SecondChance
```

使用 SSH 前，需要先把本机的 SSH 公钥添加到 GitHub。已经下载项目时，
直接进入项目目录即可，不需要再次克隆。

### 3. 安装依赖

首次克隆后推荐严格按照 `package-lock.json` 安装：

```bash
npm ci
```

`npm ci` 会清理现有的 `node_modules`，并在 `package.json` 与
`package-lock.json` 不一致时停止，适合获得可复现的安装结果。

日常开发、添加或更新依赖时使用：

```bash
npm install
```

不要把 `node_modules` 提交到 Git 仓库；它会根据锁文件在每台电脑上重新安装。

### 4. 配置环境变量

macOS/Linux：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

然后编辑项目根目录中的 `.env.local`：

```dotenv
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5-mini
```

- `OPENAI_API_KEY` 是可选项。留空时应用仍可完整启动，但会使用本地草稿和本地模拟回复，不会调用 OpenAI API。
- 配置有效的 `OPENAI_API_KEY` 后，问卷生成和连续对话会使用真实 AI 回复。
- `OPENAI_MODEL` 是可选项；不设置时，服务端默认使用 `gpt-5-mini`。
- 修改 `.env.local` 后请停止并重新启动开发服务器，确保新配置生效。
- 不要把真实 API Key 写入 README、源代码、`.env.example`，也不要提交 `.env.local`。

项目的 `.gitignore` 已忽略 `.env*`，只允许提交不含密钥的
`.env.example`。提交前仍建议运行 `git status`，确认没有意外包含敏感文件。

### 5. 启动开发服务器

标准启动方式：

```bash
npm run dev
```

等待终端出现 `Local` 地址后再打开浏览器。默认通常是：

```text
http://localhost:3000
```

如果 3000 端口已被占用，开发服务器可能选择其他端口；应以终端实际输出的
地址为准。启动服务器的终端窗口需要保持运行。

### 6. 确认服务是否正在运行

最简单的方法是打开终端显示的本地地址。macOS/Linux 也可以检查 3000 端口：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

看到 `node` 相关进程表示服务正在监听；没有输出通常表示服务尚未启动。

停止服务器时，回到运行 `npm run dev` 的终端并按：

```text
Ctrl+C
```

### 7. Cloudflare 本地代理报错时的备用方式

标准命令会通过 vinext、Vite、Wrangler 和 Cloudflare Miniflare 模拟部署环境。
在少数本地环境中，可能出现以下错误：

```text
listen EPERM: operation not permitted 0.0.0.0:9229
fetch failed
500 Internal Server Error
```

先按 `Ctrl+C` 停止失败的进程，确认 Node.js 版本满足要求并重新执行
`npm ci`。如果仍然失败，可以临时绕过 Cloudflare 本地代理，直接启动
Next.js：

```bash
npm exec -- next dev -p 3001
```

然后打开：

```text
http://localhost:3001
```

该方式适合本地检查页面、问卷以及当前 API 路由，但没有模拟 Cloudflare
绑定。涉及 D1、R2 或部署环境差异时，仍应以标准的 `npm run dev` 和
`npm run build` 为准。

### 8. 常见问题

#### 页面打不开

- 确认启动终端没有退出或报错。
- 确认浏览器地址和终端显示的端口一致。
- 如果端口被占用，停止旧进程或换一个端口启动。
- 不要把 `localhost` 地址发给其他人；它只代表运行服务器的本机。

#### 页面能打开，但只显示本地草稿模式

- 确认文件名是 `.env.local`，而不是 `.env.local.txt`。
- 确认 `OPENAI_API_KEY` 不为空且没有多余引号或空格。
- 修改环境变量后重启开发服务器。
- 如果 Key 无效、额度不足、模型不可用或网络请求失败，应用会自动回退到本地草稿模式，并显示相应提示。

#### 安装依赖失败或依赖缺失

确认 Node.js 版本后，在项目根目录重新执行：

```bash
npm ci
```

不要从其他操作系统复制 `node_modules`；应在目标电脑上重新安装。

## 构建、验证与生产模式

生成生产构建：

```bash
npm run build
```

在成功构建后启动本地生产模式：

```bash
npm run start
```

运行完整测试（包含一次生产构建）：

```bash
npm test
```

运行代码检查：

```bash
npm run lint
```

## 数据与密钥安全

- 浏览器不会持久化问卷内容；刷新、清空本次记忆或关闭页面后，不应依赖应用恢复本次内容。
- 配置 API Key 后，生成回复所需的问卷内容和对话记录会由服务端发送到 OpenAI API。
- OpenAI Responses API 请求使用 `store: false`。
- 应用自身不把问卷和对话写入数据库。
- `.env.local` 只用于本机，不会随 Git 克隆或推送自动同步；每位开发者都应配置自己的密钥。
