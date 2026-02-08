# Frontend 本地调试启动（自动打开多浏览器）

本文档用于在本机启动 `mahjong-frontend` 的本地调试环境，并**自动打开**：

- 1 个 Chrome 普通窗口页面
- 1 个 Chrome 匿名（Incognito）窗口页面
- 1 个 Safari 页面
- 1 个 Firefox 页面

> 适用环境：macOS（使用 `open` 命令）。

---

## 0. 前置条件

- Node.js / npm 已安装
- 已在项目目录安装依赖：

```bash
cd mahjong-frontend
npm i
```

---

## 1. 启动 Vite Dev Server

在项目根目录启动：

```bash
cd mahjong-frontend
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

启动后默认地址：

- http://localhost:5173/

> 如果端口被占用，`--strictPort` 会直接报错（避免默默换端口导致打开错页面）。

---

## 2. 自动打开 4 个浏览器页面

在**另一个终端窗口**执行（把 URL 按需替换）：

```bash
URL="http://localhost:5173/"

# Chrome：普通窗口
open -na "Google Chrome" --args "$URL"

# Chrome：匿名窗口（Incognito）
open -na "Google Chrome" --args --incognito "$URL"

# Safari
open -a "Safari" "$URL"

# Firefox：普通窗口
open -a "Firefox" "$URL"
```

### 可选：Firefox 也用隐私窗口

如果你更想要 Firefox 也用隐私窗口（private window）：

```bash
URL="http://localhost:5173/"
open -na "Firefox" --args -private-window "$URL"
```

---

## 3. 一键启动（可复制粘贴）

下面这段会：先启动 dev server（前台运行），然后你可以再开一个终端执行打开浏览器。

### 3.1 终端 1：启动前端

```bash
cd mahjong-frontend
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

### 3.2 终端 2：打开浏览器

```bash
URL="http://localhost:5173/"
open -na "Google Chrome" --args "$URL"
open -na "Google Chrome" --args --incognito "$URL"
open -a "Safari" "$URL"
open -a "Firefox" "$URL"
```

---

## 4. 常见问题

### 4.1 Chrome/Firefox 应用名不匹配

如果你的系统里应用名称不同（例如安装了 Beta / Canary），把命令里的应用名替换即可，例如：

- `Google Chrome Canary`
- `Firefox Developer Edition`

可以在 `/Applications` 里确认实际名字。

### 4.2 需要用局域网地址测试

Vite 打印的 Network 地址（例如 `http://192.168.x.x:5173/`）可以用于手机/其它电脑访问。

