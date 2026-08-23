#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BibiGPT 开放 API 最小闭环 Demo
功能：① 查余额  ② 视频/音频链接总结 (/v1/summarize)  ③ 字幕抓取 (/v1/getSubtitle)

用法：
    1. 先拿到 API Token：https://bibigpt.co/user/integration
    2. 设置环境变量（可选）：set BIBIGPT_API_TOKEN=你的token
       不设置的话，运行时会让你输入。
    3. python bibigpt_demo.py
"""
import json
import os
import re
import sys
import requests

# Windows 终端/Pipe 输出中文时强制 UTF-8，防止乱码
sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://api.bibigpt.co/api"
TIMEOUT = 600  # 总结是同步请求，长视频可能要跑几分钟


def get_token() -> str:
    """从环境变量或手动输入获取 Token"""
    token = os.environ.get("BIBIGPT_API_TOKEN", "").strip()
    if not token:
        print("未检测到环境变量 BIBIGPT_API_TOKEN")
        print("Token 获取地址：https://bibigpt.co/user/integration")
        token = input("请粘贴你的 API Token：").strip()
    if not token:
        sys.exit("没有 Token 无法继续。")
    return token


def call_get(path: str, token: str, params: dict) -> dict:
    """统一 GET 调用 + 错误处理。成功返回 JSON dict，失败打印错误并退出。"""
    try:
        resp = requests.get(
            BASE + path,
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        sys.exit(f"网络请求失败：{e}")

    if resp.status_code != 200:
        hints = {
            400: "参数错误，检查 URL 是否完整可访问",
            401: "Token 无效或未提供，检查 Token 是否正确",
            403: "权限/额度不足，去 https://bibigpt.co/shop 充值时长",
            404: "接口不存在",
            422: "音视频超出时长限制（limitation.maxDuration）",
            500: "BibiGPT 服务端错误，稍后再试",
        }
        hint = hints.get(resp.status_code, "")
        sys.exit(f"HTTP {resp.status_code} {hint}\n响应内容：{resp.text[:500]}")

    return resp.json()


def safe_name(raw: str) -> str:
    """把 id（可能是完整 URL）清洗成合法文件名"""
    name = re.sub(r"[^\w\-.]+", "_", str(raw))
    return name[:80] or "result"


def show_billing(data: dict):
    """打印本次消耗和剩余额度（秒 → 分钟）"""
    cost = data.get("costDuration", 0)
    remain = data.get("remainingTime", 0)
    print(f"\n💰 本次扣费时长 {cost/60:.1f} 分钟，剩余额度 {remain/60:.1f} 分钟")


# ---------- ① 查余额 ----------
def cmd_me(token: str):
    data = call_get("/v1/me", token, {})
    print(json.dumps(data, ensure_ascii=False, indent=2))


# ---------- ② 总结 ----------
def cmd_summarize(token: str, url: str):
    print("⏳ 正在总结（同步请求，长视频需要等待几分钟）...")
    data = call_get("/v1/summarize", token, {"url": url})

    if not data.get("success"):
        sys.exit(f"总结失败：{json.dumps(data, ensure_ascii=False)[:500]}")

    summary = data.get("summary", "")
    print("\n===== 总结结果 =====")
    print(summary)
    print(f"\n🔗 网页版结果页：{data.get('htmlUrl', '')}")
    show_billing(data)

    fname = f"bibigpt_summary_{safe_name(data.get('id') or 'result')}.md"
    with open(fname, "w", encoding="utf-8") as f:
        f.write(summary)
    print(f"💾 总结已保存到：{fname}")


# ---------- ③ 字幕抓取 ----------
def cmd_subtitle(token: str, url: str):
    print("⏳ 正在抓取字幕（不走 LLM，通常较快）...")
    data = call_get("/v1/getSubtitle", token, {"url": url})

    # 字幕数组在 detail.subtitlesArray 里，字段：startTime / end / text / index
    detail = data.get("detail") or {}
    subs = detail.get("subtitlesArray")
    if subs is None:  # 兜底：有的返回可能直接放在顶层
        subs = data.get("subtitlesArray") or []
    if not subs:
        sys.exit(f"未取得字幕，原始响应如下：\n{json.dumps(data, ensure_ascii=False)[:800]}")

    def fmt(sec: float) -> str:
        m, s = divmod(int(sec), 60)
        return f"{m:02d}:{s:02d}"

    lines = [f"[{fmt(x.get('startTime', 0))}] {x.get('text', '').strip()}" for x in subs]

    print(f"\n===== 字幕（共 {len(lines)} 条）=====")
    for line in lines[:30]:
        print(line)
    if len(lines) > 30:
        print(f"... 省略 {len(lines) - 30} 条，完整内容已写入文件")
    show_billing(data)

    fname = f"bibigpt_subtitles_{safe_name(data.get('id') or 'result')}.txt"
    with open(fname, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"💾 完整字幕已保存到：{fname}")


def main():
    print("=" * 40)
    print("  BibiGPT API 最小闭环 Demo")
    print("=" * 40)
    token = get_token()

    while True:
        print("\n请选择功能：")
        print("  1. 查询账号额度 (/v1/me)")
        print("  2. 链接总结     (/v1/summarize)  支持 B站/YouTube/文件直链")
        print("  3. 字幕抓取     (/v1/getSubtitle)")
        print("  q. 退出")
        choice = input("输入选项 > ").strip().lower()

        if choice == "1":
            cmd_me(token)
        elif choice in ("2", "3"):
            url = input("粘贴音视频链接（或 mp3/mp4 等文件直链）> ").strip()
            if not url:
                continue
            cmd_summarize(token, url) if choice == "2" else cmd_subtitle(token, url)
        elif choice == "q":
            break


if __name__ == "__main__":
    main()
