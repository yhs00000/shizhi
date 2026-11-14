# 拾知

“拾知”是一款短视频知识碎片消化器，专治“收藏了从不回看越堆越多”。享受奶头乐的中途，刷到知识视频只需粘贴链接，AI 即自动解析出核心要点，静默整理入库；每晚定点将当日最重要的 2 条精选推送到手机主屏，其余内容零打扰。

---

# BibiGPT API 最小闭环 Demo 包

黑客松用：[BibiGPT 开放 API](https://docs.bibigpt.co/api-reference/introduction)（beta）的接入示例，
已实现并真实验证三个接口：**查额度 / 链接总结 / 字幕抓取**。Python 与 TypeScript 两个版本功能完全一致。

## 目录结构

```
bibigpt-pack/
├── README.md
├── docs/
│   └── bibigpt_openapi.json      # 官方 OpenAPI 规范（全部 40 个端点，本地参考）
├── mobile/                       # 拾知 App（React Native / Expo）
├── web/
│   └── index.html                # 拾知网页版（纯前端单文件，含接入教程，真实调用 BibiGPT API）
├── python/
│   └── bibigpt_demo.py           # Python 版（依赖：requests）
└── typescript/
    └── ...                       # TypeScript 版
```

---

## App 打包与更新（EAS）

### 架构说明

App 为「云端 API + 本地存储」架构：AI 解析走 BibiGPT 云端 API，卡片数据存手机本地 AsyncStorage，每日精选推送为手机本地定时通知。**无需自建后端服务器**，打包成独立 APK 后即可离线日常使用。

### 首次构建 preview 安装包（可独立运行）

```bash
cd mobile
npx eas-cli build --platform android --profile preview
```

- 构建在 EAS 云端完成（约 15-30 分钟），完成后得到 APK 下载链接，发手机安装即可
- 与开发用的 dev-client 包区别：preview 包把 JS 代码打进包内，电脑关机也能用
- 配置位于 `app.json`（runtimeVersion + updates.url）与 `eas.json`（preview channel）

### 日常更新（EAS Update 热更新）

改了 JS/TS 代码后（无需重装 APK）：

```bash
cd mobile
npx eas-cli update --branch preview --message "更新说明"
```

手机上的 App 下次打开时自动拉取新包。仅当改动涉及原生依赖/权限/图标等时，才需要重新 `eas build`。

### 新手引导

首次打开 App 会强制进入 BibiGPT Token 接入引导（获取→粘贴→/v1/me 验证→进入），可跳过或按返回键回退；「我的」页可随时重新运行引导。

---

## 网页版

**🌐 在线直接使用（GitHub Pages）：<https://yhs00000.github.io/shizhi/web/>**

`web/index.html` 是拾知的纯前端网页版（无需安装、无需后端），与 App 共用同一套 BibiGPT API 调用逻辑：

- 直接双击打开即可使用（或用任意静态服务器托管），数据存在浏览器本地（localStorage），Token 不会上传到任何第三方服务器
- 首次打开会进入接入教程：获取 Token → 粘贴 → `/v1/me` 验证 → 进入，之后在「我的」页可随时重新运行教程
- 真实调用 `api.bibigpt.co`（已验证该 API 对浏览器开放 CORS），支持三种制卡模式、短链展开、同内容去重、知识树归档
- 未内置任何演示 Token——必须接入你自己的 BibiGPT Token 才能解析
