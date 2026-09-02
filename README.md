<div align="center">

# 🗺️ 新疆旅游路线自动生成器

> ⭐ **喜欢这个项目？请先点个 Star ⭐ 支持一下，让更多人看到！**

![GitHub stars](https://img.shields.io/github/stars/yishui111/luyouzidongluxian.svg?style=flat-square&color=orange)
![GitHub forks](https://img.shields.io/github/forks/yishui111/luyouzidongluxian.svg?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/yishui111/luyouzidongluxian.svg?style=flat-square)

**输入景点名称，自动在地图上连线生成新疆旅游路线 —— 纯静态网页工具，无需安装、无需后端、开箱即用。**

</div>

---

## ✨ 项目简介

新疆地域辽阔、景点分散，规划自驾路线很费神。本项目把新疆主要景点内置到浏览器端地图中，你只需要**输入景点名称（中文/拼音）逐个添加**，页面就会自动把景点**在地图上连线成旅行轨迹**，并实时统计全程公里数与预计驾车时长，是出行前规划路线的小助手。

- **纯前端**：`index.html + css + js + data`，无任何第三方依赖、无后端、无构建步骤
- 任意操作系统 + 现代浏览器即可运行
- 数据全部在本地 `data/` 中，可自由增删景点

## 🎯 主要功能

- 🔍 **搜索添加景点**：输入中文或拼音（如 `喀纳斯` / `kanas`）自动联想，点选即上地图
- 🧭 **智能排序**：从第一个景点开始就近依次连接，一键优化路线顺序
- ▶️ **播放轨迹动画**：支持 0.5x ~ 4x 速度播放全程路线，配有进度条
- 🎨 **轨迹样式自定义**：路线颜色、文字颜色、标签背景色均可自选，支持渐变与 6 种预设色
- 📍 **经典线路一键示例**：内置「北疆经典」「独库公路」「南疆风情」「全景大环线」四条示例路线
- 📊 **实时统计**：已选景点数、全程直线里程（km）、预计驾车时长
- 🖱️ **地图点选**：直接点击地图上的圆点也能添加景点

## 🗂️ 目录结构

```
luyouzidongluxian/
├── index.html          # 入口页面
├── css/style.css       # 样式
├── js/main.js          # 交互与画线逻辑
├── data/
│   ├── attractions.js  # 景点数据（名称/坐标/拼音）
│   └── xinjiang.js     # 新疆地图数据
├── 预览图.png           # 效果预览截图
├── 部署方案.md           # 原部署笔记
├── 项目速览.md           # 原速览笔记
├── start.bat           # Windows 一键打开
└── README.md
```

## 🚀 快速开始

### 方式一：直接打开（推荐）

克隆或下载本仓库后，**双击 `index.html`** 用浏览器打开即可使用。

### 方式二：本地静态服务

```bash
git clone https://github.com/yishui111/luyouzidongluxian.git
cd luyouzidongluxian
python -m http.server 8000
```

浏览器访问 <http://localhost:8000>

### Windows 一键启动

双击 `start.bat`（会自动用默认浏览器打开页面）。

## ✅ 验证

1. 页面打开后在搜索框输入「喀纳斯」能联想并添加景点
2. 点「北疆经典」示例按钮可一键生成完整路线
3. 切换轨迹颜色、拖动播放进度均正常

## 🛠️ 本地开发 & 提交

```bash
git add .
git commit -m "feat: 新增景点数据"
git push origin main
```

## ❓ 常见问题

- **Q：双击 index.html 显示空白？** A：请用 Chrome / Edge / Firefox 等现代浏览器打开。
- **Q：想加自己的景点？** A：在 `data/attractions.js` 中按现有格式追加 `{名称, 拼音, 经纬度}` 即可。

## ⚠️ 注意事项

- 路线里程为两点间**直线距离估算**，实际驾车里程请以导航为准
- 项目仅供个人出行规划与学习交流使用

## 📄 许可证

MIT License

---

## 🙏 支持与致谢

如果这个小工具帮到了你，**请点亮右上角的 ⭐ Star**，你的支持是我持续更新的最大动力！
