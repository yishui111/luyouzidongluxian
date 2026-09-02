# 新疆旅游路线自动生成器 · 部署方案

> 目标：在一台新电脑上，把本项目**拉下来即可运行**。

## 1. 环境要求

- 任意操作系统（Windows / macOS / Linux）
- 现代浏览器（Chrome / Edge / Firefox 等）
- 可选：Python 3（若要用本地静态服务器方式启动）

## 2. 获取代码

```bash
git clone https://github.com/yishui111/luyouzidongluxian.git
cd luyouzidongluxian
```

> 不会用 git？直接到 GitHub 仓库页面点绿色 `Code` → `Download ZIP`，解压即可，效果完全一样。

## 3. 启动方法

| 方式 | 操作 | 适用场景 |
| ---- | ---- | ---- |
| 直接打开 | 双击 `index.html` | 本机临时用 |
| 静态服务器 | `python -m http.server 8000` 后访问 http://localhost:8000 | 局域网分享 |
| Windows 一键 | 双击 `start.bat` | 自动打开默认浏览器 |

## 4. 验证

页面打开后：搜索添加「喀纳斯」能上地图 → 点「北疆经典」示例按钮生成路线 → 统计区显示里程/时长 → 播放按钮可用。以上都正常即部署成功。

## 5. 常见问题排查

- **双击没反应/空白**：换 Chrome/Edge 打开；确认文件未损坏（重新 git pull）。
- **端口被占用**：换端口，如 `python -m http.server 8080`。
- **想分享给同一局域网的人**：让对方访问 `http://你电脑的IP:8000`（需防火墙放行）。

## 6. 更新约定

每次修改代码后同步更新本文件与 README.md。
