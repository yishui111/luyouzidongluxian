# AGENTS.md — 新疆旅游路线自动生成器 项目档案与维护约定

> ⚠️ **修改本仓库前请先通读本文件**：本文件是给「AI 助手 / 开发者」看的项目记忆，记录项目情况、本仓库内容边界与维护约定，避免重复勘探、误删误传。用户向文档见 README.md。

## 1. 项目定位（一句话）

输入新疆景点名称（中文/拼音），自动在地图上连线生成旅游路线的**纯静态网页工具**：零依赖、零后端、零构建，任意浏览器双击 index.html 即用。

## 2. 架构与组件

| 目录/组件 | 作用 |
| ---- | ---- |
| index.html | 入口页面（UI：搜索联想、示例线路、播放控制、颜色设置） |
| css/style.css | 样式 |
| js/main.js | 交互逻辑：搜索、智能排序、轨迹画线、播放动画、里程统计 |
| data/attractions.js | 景点数据（名称/拼音/经纬度）——加景点改这里 |
| data/xinjiang.js | 新疆地图数据 |
| 预览图.png | README 用的效果截图（原文件名，勿删） |
| 部署方案.md / 项目速览.md | 原作者笔记（UTF-8） |
| start.bat / stop.bat | Windows 启停（纯静态，stop 无实际进程） |

- 技术栈：原生 HTML/CSS/JS + 数据 JS；无依赖、无构建
- 启动：双击 index.html，或 `python -m http.server 8000` 后访问 http://localhost:8000
- 验证：搜索「喀纳斯」能联想上地图 → 点「北疆经典」生成路线 → 播放/改色正常

## 3. 本仓库 = GitHub 公开裁剪版（重要边界）

本仓库是精简公开版。以下内容刻意不入库：

- 密钥类：无（本工具不联网、无密钥）
- 大件类：无模型/引擎；未来若加素材需放 data 之外并 gitignore
- 其它：原项目根目录的旧 `.git` 已按要求删除（原仓库为本地仓库、无远程、无历史价值）

> 规则：新增内容不得引入密钥/素材/大件；里程为直线估算，README 已声明以导航为准。

## 4. 跨项目依赖 / 机器特定配置

- 无。任意目录克隆即可运行。

## 5. 已知问题 / TODO / 安全注意

- 暂无已知问题。README 顶部徽章 URL 中的用户名 yishui111 与仓库名一致（luyouzidongluxian）。
- 版权注意：景点/地图数据来源需自行保证可公开。

## 6. 维护更新约定

- 改动代码后：同步更新 README.md 与 DEPLOY.md；新增景点在 data/attractions.js 按格式追加
- 提交：`git add . && git commit -m "..." && git push origin main`
- 中文文档用 UTF-8；`.bat` 纯 ASCII + CRLF + 无 BOM
---
### 关键点（2026-09-02 上传整理补充）
- 纯静态：index.html + css/js + data/*.js；无依赖/无密钥/无后端
- 加景点改 data/attractions.js（名称/拼音/经纬度）；里程为直线估算，README 已声明
- start.bat/stop.bat 为纯静态占位（stop 无进程）；预览图.png 是 README 插图勿删
- README 徽章用户名 yishui111 已替换；克隆后双击 index.html 即用
