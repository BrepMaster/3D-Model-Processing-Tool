# 3D 模型处理工具 / 3D Model Processing Tool

基于 Flask + Three.js 的 3D 模型处理 Web 应用。

A Flask + Three.js based 3D model processing web application.

## 📋 项目摘要 / Project Summary

这是一个功能强大的 3D 模型处理工具，提供模型查看、简化、格式转换和 STEP 文件分析等核心功能。支持多种主流 3D 格式，具有美观的 UI 主题和完善的新手引导系统。

This is a powerful 3D model processing tool with core features including model viewing, simplification, format conversion, and STEP file analysis. It supports multiple mainstream 3D formats with beautiful UI themes and a comprehensive onboarding system.

**核心功能 / Core Features:**
- 🎨 **3D 可视化** - 实时渲染和交互查看
- ⚡ **模型简化** - 智能减少面数优化模型
- 🔄 **格式转换** - 支持多种格式互转
- 📐 **STEP 分析** - 专业 CAD 文件处理
- 🎭 **多主题** - 14 种精美界面主题

**技术亮点 / Technical Highlights:**
- Flask + Three.js 全栈架构
- 自动文件清理机制
- 完善的日志系统
- 响应式设计

---

## 目录 / Table of Contents

- [功能特性 / Features](#功能特性--features)
- [技术栈 / Technology Stack](#技术栈--technology-stack)
- [快速开始 / Quick Start](#快速开始--quick-start)
- [使用说明 / Usage](#使用说明--usage)
- [支持格式 / Supported Formats](#支持格式--supported-formats)
- [项目结构 / Project Structure](#项目结构--project-structure)
- [配置说明 / Configuration](#配置说明--configuration)
- [API 接口 / API Endpoints](#api-接口--api-endpoints)
- [注意事项 / Notes](#注意事项--notes)
- [常见问题 / FAQ](#常见问题--faq)
- [许可证 / License](#许可证--license)

---

## 功能特性 / Features

| 中文 | English |
|------|---------|
| 多格式支持：STL、OBJ、3MF、PLY、OFF、DAE、GLTF、STEP/STP | Multi-format support: STL, OBJ, 3MF, PLY, OFF, DAE, GLTF, STEP/STP |
| 3D 可视化：实时渲染，支持旋转、缩放、平移 | 3D Visualization: Real-time rendering with rotation, zoom, pan |
| 模型简化：可调节简化比例，提供预设档位 | Mesh Simplification: Adjustable reduction ratio with presets |
| 格式转换：STL、OBJ、3MF 之间相互转换 | Format Conversion: Convert between STL, OBJ, 3MF |
| 包围盒计算：自动计算模型尺寸 | Bounding Box Calculation: Auto calculate model dimensions |
| 多主题支持：14种界面主题 | Multi-theme Support: 14 beautiful UI themes |
| STEP 文件分析：面面积计算、颜色信息、GLTF导出 | STEP File Analysis: Face area calculation, color info, GLTF export |
| 日志系统：完善的日志记录 | Log System: Comprehensive logging |
| 自动清理：24小时自动清理过期文件 | Auto Cleanup: 24-hour automatic file cleanup |
| 新手引导：首次访问自动弹出引导教程 | Onboarding Guide: Auto-popup guide for new users |
| 操作提示：每个页面都有操作步骤提示 | Operation Tips: Step-by-step tips on every page |

---

## 技术栈 / Technology Stack

| 中文 | English |
|------|---------|
| 后端框架：Flask | Backend: Flask |
| 3D 处理：trimesh, numpy-stl, pythonocc-core | 3D Processing: trimesh, numpy-stl, pythonocc-core |
| 前端可视化：Three.js | Frontend Visualization: Three.js |
| 样式方案：CSS 变量 + 主题系统 | Styling: CSS Variables + Theme System |

---

## 快速开始 / Quick Start

### 1. 环境要求 / Requirements

- Python 3.8+
- 现代浏览器（Chrome、Firefox、Edge等）/ Modern browsers

### 2. 安装依赖 / Install Dependencies

```bash
pip install -r requirements.txt
```

> **注意 / Note**：如需 STEP 文件分析功能，需额外安装 / For STEP analysis:
> ```bash
> pip install pythonocc-core
> ```

### 3. 运行应用 / Run Application

```bash
# Windows
start_server.bat

# 或直接运行 / Or run directly
python app.py

# 调试模式 / Debug mode
python app.py --debug
```

### 4. 访问应用 / Access

打开浏览器访问 / Open in browser: http://127.0.0.1:5000

---

## 使用说明 / Usage

### 🚀 新手引导教程 / Onboarding Guide

首次访问时自动弹出分步引导：

Auto-popup on first visit:

1. **欢迎页 / Welcome**：介绍功能概览 / Feature overview
2. **模型查看 / Viewer**：上传和查看模型 / Upload and view models
3. **模型简化 / Simplify**：设置简化比例 / Set reduction ratio
4. **格式转换 / Convert**：转换文件格式 / Convert file formats
5. **STEP 分析 / STEP Analysis**：处理 STEP 文件 / Process STEP files

### 页面操作提示 / Operation Tips

每个页面都有操作提示卡片：

Every page has operation tip cards:
- **操作步骤 / Steps**：清晰的使用流程 / Clear usage flow
- **快捷键 / Shortcuts**：鼠标操作说明 / Mouse controls
- **实用建议 / Tips**：功能使用建议 / Usage suggestions

### 鼠标控制 / Mouse Controls

| 操作 / Action | 说明 / Description |
|--------------|-------------------|
| 左键拖动 / Left drag | 旋转模型 / Rotate model |
| 右键拖动 / Right drag | 平移视角 / Pan view |
| 滚轮 / Scroll wheel | 缩放 / Zoom |

---

## 支持格式 / Supported Formats

| 格式 / Format | 描述 / Description | 输入 / Input | 输出 / Output |
|--------------|-------------------|-------------|--------------|
| STL | Standard Triangle Mesh | ✓ | ✓ |
| OBJ | Wavefront Object | ✓ | ✓ |
| 3MF | 3D Manufacturing Format | ✓ | ✓ |
| PLY | Polygon File Format | ✓ | ✗ |
| OFF | Object File Format | ✓ | ✗ |
| DAE | COLLADA | ✓ | ✗ |
| GLTF/GLB | GL Transmission Format | ✓ | ✗ |
| STEP/STP | Standard CAD Format | ✓ | ✗ (可转 GLTF) |

---

## 项目结构 / Project Structure

```
├── app.py                 # Flask 主程序 / Flask main app
├── config.py              # 配置文件 / Configuration
├── cleanup.py             # 文件清理模块 / Cleanup module
├── requirements.txt       # Python 依赖 / Dependencies
├── start_server.bat       # Windows 启动脚本 / Startup script
├── stop_server.bat        # Windows 停止脚本 / Stop script
├── services/              # 业务服务 / Services
│   ├── conversion.py      # 格式转换 / Conversion
│   ├── simplification.py  # 模型简化 / Simplification
│   └── step_service.py    # STEP 处理 / STEP processing
├── utils/                 # 工具模块 / Utilities
│   ├── file_utils.py      # 文件工具 / File utilities
│   ├── mesh_utils.py      # 网格处理 / Mesh utilities
│   └── logger.py          # 日志工具 / Logger
├── templates/             # HTML 模板 / Templates
│   ├── index.html         # 首页 / Home
│   ├── viewer.html        # 查看器 / Viewer
│   ├── simplify.html      # 简化工具 / Simplify
│   ├── convert.html       # 转换工具 / Convert
│   ├── step.html          # STEP 分析 / STEP analysis
│   └── theme.html         # 主题预览 / Themes
└── static/                # 静态资源 / Static files
    ├── css/style.css      # 样式 / Styles
    └── js/                # JavaScript
```

---

## 配置说明 / Configuration

在 `config.py` 中配置：

Configure in `config.py`:

```python
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 文件大小限制 / File size limit
FILE_MAX_AGE_HOURS = 24                  # 文件过期时间 / File expiry
LOG_MAX_AGE_HOURS = 168                  # 日志过期时间 / Log expiry
PORT = 5000                              # 端口 / Port
DEBUG = False                            # 调试模式 / Debug mode
```

---

## API 接口 / API Endpoints

| 接口 / Endpoint | 方法 / Method | 描述 / Description |
|----------------|--------------|-------------------|
| `/upload` | POST | 上传并处理模型 / Upload and process model |
| `/simplify` | POST | 简化模型 / Simplify model |
| `/convert` | POST | 格式转换 / Convert format |
| `/api/step/upload` | POST | 上传 STEP 文件 / Upload STEP |
| `/api/step/face-areas` | POST | 获取面面积 / Get face areas |
| `/api/step/to-gltf` | POST | STEP 转 GLTF / Convert to GLTF |
| `/outputs/<filename>` | GET | 下载文件 / Download file |

---

## 注意事项 / Notes

### 开发测试 / Development

- 使用 Flask 开发服务器仅用于测试 / Flask dev server for testing only
- 生产环境建议使用 Gunicorn + Nginx / Use Gunicorn + Nginx in production

### 安全提示 / Security

- 不要在公网直接暴露此服务 / Do not expose to public network
- 上传文件会在 24 小时后自动清理 / Auto cleanup after 24 hours
- 不要上传包含敏感信息的文件 / No sensitive files

---

## 常见问题 / FAQ

| 问题 / Question | 答案 / Answer |
|----------------|--------------|
| GLTF 上传失败？ | 请同时上传 .bin 文件或使用 ZIP / Upload .bin or ZIP |
| 如何启用调试模式？ | `python app.py --debug` |
| STEP 功能无法使用？ | 安装 pythonocc-core / Install pythonocc-core |
| 如何查看日志？ | 日志保存在 logs/ 目录 / Logs in logs/ |

---

## 许可证 / License

本项目仅供学习和研究使用。

For learning and research purposes only.