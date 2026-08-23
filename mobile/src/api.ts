import { CardItem, CardMode } from './types';
import { CARD_PROMPT, normalizeCardShape, parseCardJson, parseMarkdownCard } from './card';

const BASE = 'https://api.bibigpt.co/api';

const ERROR_HINTS: Record<number, string> = {
  400: '参数错误，检查链接是否完整',
  401: 'Token 无效，请到「我的」页检查',
  403: '额度不足，去 bibigpt.co/shop 充值时长',
  404: '资源不存在',
  422: '音视频超出时长限制',
  500: '服务端错误，稍后重试',
};

async function call(method: 'GET' | 'POST', path: string, token: string, opts: { params?: Record<string, string>; body?: unknown } = {}) {
  const qs = opts.params ? `?${new URLSearchParams(opts.params).toString()}` : '';
  let resp: Response;
  try {
    resp = await fetch(BASE + path + qs, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    });
  } catch (e: any) {
    throw new Error(`网络请求失败：${e?.message ?? e}`);
  }
  if (!resp.ok) {
    const body = (await resp.text()).slice(0, 300);
    throw new Error(`HTTP ${resp.status} ${ERROR_HINTS[resp.status] ?? ''}\n${body}`);
  }
  return resp.json();
}

export const getMe = (token: string) => call('GET', '/v1/me', token);

/* ---------- 短链检测与展开（官方 /v1/expandUrl，已实测） ---------- */

/** 常见分享短链域名 */
const SHORT_HOSTS = [
  'b23.tv', // B站
  'xhslink.cn', // 小红书
  'v.douyin.com', // 抖音
  'youtu.be', // YouTube
  't.cn', // 微博
  'dwz.cn',
  'url.cn',
];

export function isShortLink(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return SHORT_HOSTS.some((s) => h === s || h.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

/** 展开短链为平台落地页链接；失败时回退为原链接（交给后续接口尝试） */
export async function expandUrl(token: string, url: string): Promise<string> {
  try {
    const d = await call('GET', '/v1/expandUrl', token, { params: { url } });
    return typeof d?.url === 'string' && /^https?:\/\//.test(d.url) ? d.url : url;
  } catch {
    return url;
  }
}

interface Meta {
  fallbackTitle: string;
  author?: string;
  durationSec?: number;
  dbId?: string;
  sourceUrl: string;
}

async function summarizeDefault(token: string, url: string): Promise<{ raw: string; meta: Meta }> {
  const d = await call('GET', '/v1/summarize', token, { params: { url, includeDetail: 'true' } });
  if (!d?.success) throw new Error('总结失败：' + JSON.stringify(d).slice(0, 300));
  return {
    raw: d.summary ?? '',
    meta: {
      fallbackTitle: d.detail?.title || url,
      author: d.detail?.author,
      durationSec: d.detail?.duration,
      dbId: d.detail?.dbId,
      sourceUrl: d.sourceUrl ?? url,
    },
  };
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}_${(seq++).toString(36)}${Math.floor(Math.random() * 36).toString(36)}`;

/** 按所选模式生成知识卡片（三种模式均已对真实 API 验证过） */
export async function createCard(token: string, url: string, mode: CardMode): Promise<CardItem> {
  if (mode === 1) {
    // 单次 · 智能卡：summarizeWithConfig + customPrompt，一次请求产出卡片 JSON
    const d = await call('POST', '/v1/summarizeWithConfig', token, {
      body: {
        url,
        includeDetail: true,
        promptConfig: { customPrompt: CARD_PROMPT, isRefresh: true, outputLanguage: 'zh-CN' },
      },
    });
    if (!d?.success) throw new Error('总结失败：' + JSON.stringify(d).slice(0, 300));
    const meta: Meta = {
      fallbackTitle: d.detail?.title || url,
      author: d.detail?.author,
      durationSec: d.detail?.duration,
      sourceUrl: d.sourceUrl ?? url,
    };
    const j = parseCardJson(d.summary ?? '');
    const shape = j
      ? normalizeCardShape(j, meta.fallbackTitle)
      : parseMarkdownCard(d.summary ?? '', meta.fallbackTitle); // 兜底：AI 偶尔不守格式
    return finish(shape, meta, d.summary, mode);
  }

  if (mode === 2) {
    // 单次 · 简洁卡：默认总结 + 本地 Markdown 解析
    const { raw, meta } = await summarizeDefault(token, url);
    return finish(parseMarkdownCard(raw, meta.fallbackTitle), meta, raw, mode);
  }

  // 两次 · 精制卡：默认总结拿 dbId → byPrompt 精修成卡片 JSON
  const { raw, meta } = await summarizeDefault(token, url);
  if (!meta.dbId) throw new Error('未取得内容 ID，无法精制');
  const d2 = await call('POST', '/v1/summary/byPrompt', token, {
    body: { contentId: meta.dbId, customPrompt: CARD_PROMPT, outputLanguage: 'zh-CN' },
  });
  const refined: string = d2?.summary ?? '';
  if (!refined) throw new Error('精制失败：' + JSON.stringify(d2).slice(0, 300));
  const j = parseCardJson(refined);
  const shape = j ? normalizeCardShape(j, meta.fallbackTitle) : parseMarkdownCard(raw, meta.fallbackTitle);
  return finish(shape, meta, raw, mode);
}

function finish(
  shape: ReturnType<typeof normalizeCardShape>,
  meta: Meta,
  raw: string,
  mode: CardMode,
): CardItem {
  return {
    id: newId(),
    createdAt: Date.now(),
    url: meta.sourceUrl,
    ...shape,
    durationSec: meta.durationSec,
    author: meta.author,
    rawSummary: raw,
    stored: false,
    mode,
  };
}
