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
├── python/
│   └── bibigpt_demo.py           # Python 版（依赖：requests）
└── typescript/
    └── ...                       # TypeScript 版
```
