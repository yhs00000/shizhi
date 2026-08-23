#!/usr/bin/env node
/**
 * BibiGPT 开放 API 最小闭环 Demo（TypeScript 版）
 * 功能：① 查余额  ② 视频/音频链接总结 (/v1/summarize)  ③ 字幕抓取 (/v1/getSubtitle)
 *
 * 用法：
 *   1. 拿到 API Token：https://bibigpt.co/user/integration
 *   2. 设置环境变量（可选）：
 *        PowerShell:  $env:BIBIGPT_API_TOKEN="你的token"
 *        cmd:         set BIBIGPT_API_TOKEN=你的token
 *   3. npm install && npm start
 *
 * 依赖说明：Node 18+ 自带全局 fetch，运行时零第三方依赖。
 */

import * as readline from 'node:readline';
import { writeFileSync } from 'node:fs';

const BASE = 'https://api.bibigpt.co/api';
const TIMEOUT = 600_000; // 总结是同步请求，长视频可能要跑几分钟

// ---------- 类型（对照官方 OpenAPI 响应字段） ----------
interface Billing {
  costDuration?: number;   // 本次扣费时长（秒）
  remainingTime?: number;  // 剩余额度（秒）
}

interface SubtitleItem {
  startTime: number; // 秒
  end: number;
  text: string;
  index: number;
}

interface SummarizeResponse extends Billing {
  success: boolean;
  id?: string;             // 注意：文件直链场景下就是完整 URL
  service?: string;
  sourceUrl?: string;
  htmlUrl?: string;        // 网页版结果页
  summary?: string;
  detail?: {
    subtitlesArray?: SubtitleItem[];
    title?: string;
    duration?: number;
  } | null;
}

// ---------- 读取 Token ----------
async function getToken(ask: (q: string) => Promise<string>): Promise<string> {
  let token = (process.env.BIBIGPT_API_TOKEN || '').trim();
  if (!token) {
    console.log('未检测到环境变量 BIBIGPT_API_TOKEN');
    console.log('Token 获取地址：https://bibigpt.co/user/integration');
    token = (await ask('请粘贴你的 API Token：')).trim();
  }
  if (!token) throw new Error('没有 Token 无法继续。');
  return token;
}

// ---------- 统一 GET 调用 + 错误处理 ----------
async function callGet(path: string, token: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = BASE + path + (qs ? `?${qs}` : '');

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch (e: any) {
    throw new Error(`网络请求失败：${e?.message ?? e}`);
  }

  if (!resp.ok) {
    const hints: Record<number, string> = {
      400: '参数错误，检查 URL 是否完整可访问',
      401: 'Token 无效或未提供，检查 Token 是否正确',
      403: '权限/额度不足，去 https://bibigpt.co/shop 充值时长',
      404: '接口不存在',
      422: '音视频超出时长限制（limitation.maxDuration）',
      500: 'BibiGPT 服务端错误，稍后再试',
    };
    const body = (await resp.text()).slice(0, 500);
    throw new Error(`HTTP ${resp.status} ${hints[resp.status] ?? ''}\n响应内容：${body}`);
  }

  return resp.json();
}

// ---------- 工具 ----------
function showBilling(data: Billing): void {
  const cost = (data.costDuration ?? 0) / 60;
  const remain = (data.remainingTime ?? 0) / 60;
  console.log(`\n💰 本次扣费时长 ${cost.toFixed(1)} 分钟，剩余额度 ${remain.toFixed(1)} 分钟`);
}

function safeName(raw: string): string {
  // 把 id（可能是完整 URL）清洗成合法文件名
  return String(raw).replace(/[^\w.-]+/g, '_').slice(0, 80) || 'result';
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------- ① 查余额 ----------
async function cmdMe(token: string): Promise<void> {
  const data = await callGet('/v1/me', token);
  console.log(JSON.stringify(data, null, 2));
}

// ---------- ② 总结 ----------
async function cmdSummarize(token: string, url: string): Promise<void> {
  console.log('⏳ 正在总结（同步请求，长视频需要等待几分钟）...');
  const data = (await callGet('/v1/summarize', token, { url })) as SummarizeResponse;

  if (!data.success) {
    throw new Error(`总结失败：${JSON.stringify(data).slice(0, 500)}`);
  }

  const summary = data.summary ?? '';
  console.log('\n===== 总结结果 =====');
  console.log(summary);
  console.log(`\n🔗 网页版结果页：${data.htmlUrl ?? ''}`);
  showBilling(data);

  const fname = `bibigpt_summary_${safeName(data.id ?? 'result')}.md`;
  writeFileSync(fname, summary, 'utf-8');
  console.log(`💾 总结已保存到：${fname}`);
}

// ---------- ③ 字幕抓取 ----------
async function cmdSubtitle(token: string, url: string): Promise<void> {
  console.log('⏳ 正在抓取字幕（不走 LLM，通常较快）...');
  const data = (await callGet('/v1/getSubtitle', token, { url })) as SummarizeResponse;

  // 字幕数组在 detail.subtitlesArray 里
  const subs: SubtitleItem[] = data.detail?.subtitlesArray ?? (data as any).subtitlesArray ?? [];
  if (subs.length === 0) {
    throw new Error(`未取得字幕，原始响应如下：\n${JSON.stringify(data).slice(0, 800)}`);
  }

  const lines = subs.map((x) => `[${fmt(x.startTime ?? 0)}] ${(x.text ?? '').trim()}`);

  console.log(`\n===== 字幕（共 ${lines.length} 条）=====`);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (lines.length > 30) console.log(`... 省略 ${lines.length - 30} 条，完整内容已写入文件`);
  showBilling(data);

  const fname = `bibigpt_subtitles_${safeName(data.id ?? 'result')}.txt`;
  writeFileSync(fname, lines.join('\n'), 'utf-8');
  console.log(`💾 完整字幕已保存到：${fname}`);
}

// ---------- 主循环 ----------
async function main(): Promise<void> {
  console.log('='.repeat(40));
  console.log('  BibiGPT API 最小闭环 Demo（TypeScript）');
  console.log('='.repeat(40));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

  try {
    const token = await getToken(ask);

    for (;;) {
      console.log('\n请选择功能：');
      console.log('  1. 查询账号额度 (/v1/me)');
      console.log('  2. 链接总结     (/v1/summarize)  支持 B站/YouTube/文件直链');
      console.log('  3. 字幕抓取     (/v1/getSubtitle)');
      console.log('  q. 退出');
      const choice = (await ask('输入选项 > ')).trim().toLowerCase();

      try {
        if (choice === '1') {
          await cmdMe(token);
        } else if (choice === '2' || choice === '3') {
          const url = (await ask('粘贴音视频链接（或 mp3/mp4 等文件直链）> ')).trim();
          if (!url) continue;
          if (choice === '2') await cmdSummarize(token, url);
          else await cmdSubtitle(token, url);
        } else if (choice === 'q') {
          break;
        }
      } catch (e: any) {
        console.error(`\n❌ ${e?.message ?? e}`); // 单次失败不退出，回到菜单
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
