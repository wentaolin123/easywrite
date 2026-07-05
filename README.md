# 内容监控雷达

> 一站式内容监控、选题分析与管理平台
>
> 在线体验：https://wentaolin123.github.io/easywrite/

## 项目简介

内容监控雷达是一款面向内容创作者和运营团队的监控与分析工具。它可以帮助你追踪微信公众号、小红书等平台的热门内容，收集有价值的选题，并通过 AI 进行智能分析，辅助内容决策。

无论是追踪行业动态、监控竞品账号，还是挖掘爆款选题，内容监控雷达都能让你的内容运营工作更加高效。

## 功能特性

### 📡 内容监控
- **多平台监控** — 支持微信公众号、小红书等平台内容抓取
- **分类管理** — 支持创建/删除/重命名监控分类，灵活管理不同主题
- **定时采集** — 每天 02:00 自动采集数据
- **手动抓取** — 支持对单个分类手动触发爬取

### 📊 内容大盘
- **三维筛选** — 按平台、关键词、对标账号快速过滤内容
- **内容列表** — 支持分页浏览（10/20/50/100/200 条/页）
- **全选/批量删除** — 高效管理已采集内容
- **数据导出** — 一键导出监控数据

### 🤖 AI 选题分析
- **时间线视图** — 按时间线查看选题分布
- **近期选题汇总库** — 收藏有价值的选题，双列布局展示
- **AI 智能分析** — 基于配置的提示词，自动分析选题价值
- **自定义提示词** — 可配置 AI 分析提示词，个性化分析维度

### ⚙️ 监控设置
- **平台配置** — 为每个分类独立配置监控平台（微信公众号、小红书）
- **API 配置** — 设置 API 地址和 Key，启用数据源
- **关键词管理** — 配置监控关键词，精准捕获相关内容
- **对标账号** — 配置对标账号，追踪竞品动态

### 🛠 工具中心
- **排版大师** — 内置排版工具，一键进入排版工作台

## 效果预览

> 你可以直接访问在线演示地址查看效果：
>
> 🔗 https://wentaolin123.github.io/easywrite/

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML + CSS + JavaScript、Tailwind CSS、Lucide 图标 |
| 后端 | Node.js + Express + SQLite |
| 代理 | Node.js HTTP 代理（解决 CORS） |
| 存储 | SQLite（本地数据库） |

## 环境要求

- Node.js >= 14.x
- npm（随 Node.js 安装）
- 现代浏览器（Chrome / Edge / Firefox / Safari）

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/wentaolin123/easywrite.git
cd easywrite
```

### 2. 安装依赖

**前端依赖：**

```bash
npm install
```

**后端依赖：**

```bash
cd backend
npm install
cd ..
```

### 3. 初始化数据库

```bash
cd backend
npm run migrate
cd ..
```

### 4. 启动服务

**启动后端 API 服务（端口 3001）：**

```bash
cd backend
npm start
```

**启动跨域代理服务（端口 3000）：**

```bash
node proxy.js
```

**打开前端页面：**

双击 `index.html` 或在浏览器中打开 `http://localhost:8080/index.html`。

> 如果遇到跨域问题，请确保代理服务（proxy.js）正在运行。

## 部署到 GitHub Pages

本项目已配置为通过 GitHub Pages 直接部署。仓库根目录的 `index.html` 会作为默认首页自动渲染。

访问地址：`https://wentaolin123.github.io/easywrite/`

### 部署步骤

1. 将代码 push 到 GitHub 仓库
2. 进入仓库 Settings → Pages
3. Source 选择 Deploy from a branch → main → /(root)
4. 等待 1-2 分钟后访问上述链接

## 项目结构

```
easywrite/
├── index.html             # 主页面（单文件前端应用）
├── tailwind.css           # Tailwind 编译后的样式
├── lucide.min.js          # Lucide 图标库
├── sql-wasm.js / .wasm    # SQLite WASM 模块
├── proxy.js               # 跨域代理服务（端口 3000）
├── proxy-server.js        # 备选代理服务
├── tailwind.config.js     # Tailwind 配置
├── input.css              # Tailwind 输入样式
├── package.json           # 前端依赖
├── README.md              # 项目说明
│
├── backend/               # 后端服务
│   ├── server.js          # Express 服务入口（端口 3001）
│   ├── package.json
│   ├── config/
│   │   └── database.js    # 数据库配置
│   ├── models/            # 数据模型
│   │   ├── CategoryConfig.js
│   │   ├── ContentItem.js
│   │   ├── ContentSnapshot.js
│   │   └── SearchHistory.js
│   ├── routes/            # API 路由
│   │   ├── categories.js
│   │   ├── content.js
│   │   ├── searchHistory.js
│   │   └── snapshots.js
│   ├── migrations/        # 数据库迁移
│   │   ├── 001_init.sql
│   │   └── migrate.js
│   └── data/              # SQLite 数据库文件
│       └── content_monitor.db
│
└── .gitignore             # Git 忽略配置
```

## 使用指南

### 1. 创建监控分类

在左侧侧边栏点击「新建监控分类」，输入分类名称即可创建。

### 2. 配置监控规则

选择分类后，切换到「监控设置」Tab，配置：
- 平台 API（公众号、小红书）
- 关键词列表
- 对标账号
- AI 分析提示词

### 3. 抓取数据

点击顶部「抓取」按钮或分类卡片上的刷新图标，开始抓取数据。

### 4. 查看分析

抓取完成后，切换到「内容大盘」查看内容列表，或切换到「选题分析」进行 AI 分析。

### 5. 使用排版大师

点击左侧「排版大师」按钮，打开排版工具页面。

## 配置说明

### 跨域代理

代理服务运行在 `http://localhost:3000`，用于转发前端请求到目标 API，解决浏览器的 CORS 限制。

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/content` | GET | 获取内容列表 |
| `/api/content/batch` | POST | 批量保存内容 |
| `/api/categories` | GET | 获取分类配置 |
| `/api/search-history` | GET | 获取搜索历史 |
| `/api/search-history/keywords/cloud` | GET | 关键词云 |
| `/api/snapshots` | GET | 获取内容快照 |

### 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 跨域代理 | 3000 | 转发前端请求到目标 API |
| 后端 API | 3001 | 提供 RESTful API 接口 |

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
