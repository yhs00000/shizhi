import { CardMode } from './types';
import { domainStyle } from './theme';

/**
 * 三种制卡模式共用的「卡片 JSON」提示词 —— 已实测 BibiGPT 能遵守该格式输出
 */
export const CARD_PROMPT = `请把这条音视频内容整理成知识卡片，严格输出JSON，不要用markdown代码块包裹，不要输出其他多余文字。字段：
{"title":"不超过20字的标题","domain":"所属领域，如职场成长/AI与效率/心理/科技/学习/生活/音乐/商业/其他","tldr":"一句话精华不超过40字","points":["核心要点1","核心要点2"],（3到5条每条不超30字）"tags":["标签"],（3到5个）"verdict":"建议回看 或 摘要足够","verdictReason":"不超过40字的理由"}`;

/** 宽松提取首个 JSON 对象并解析；失败返回 null */
export function parseCardJson(text: string): Partial<CardShape> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface CardShape {
  title: string;
  domain: string;
  tldr: string;
  points: string[];
  tags: string[];
  verdict: '建议回看' | '摘要足够';
  verdictReason: string;
}

const stripMd = (s: string) =>
  s
    .replace(/[*_`>#]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();

const toArr = (x: unknown, max: number): string[] =>
  Array.isArray(x) ? x.map((v) => stripMd(String(v))).filter(Boolean).slice(0, max) : [];

/** 把模式 A/C 的 JSON 结果规整为卡片内容 */
export function normalizeCardShape(j: Partial<CardShape>, fallbackTitle: string): CardShape {
  const domain = stripMd(String(j.domain ?? '')) || guessDomain('', [], '');
  return {
    title: stripMd(String(j.title ?? '')).slice(0, 24) || fallbackTitle,
    domain,
    tldr: stripMd(String(j.tldr ?? '')) || '暂无一句话精华',
    points: toArr(j.points, 5),
    tags: toArr(j.tags, 5).map((t) => t.replace(/^#/, '')),
    verdict: j.verdict === '建议回看' ? '建议回看' : '摘要足够',
    verdictReason: stripMd(String(j.verdictReason ?? '')) || '按摘要浏览即可掌握大意。',
  };
}

/**
 * 模式 B：默认 Markdown 总结 → 本地解析成卡片
 * 兼容 BibiGPT 默认输出结构：## 摘要 / ## 亮点 / #标签 / ## 思考
 */
export function parseMarkdownCard(raw: string, fallbackTitle: string): CardShape {
  const section = (name: string): string => {
    const m = raw.match(new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`));
    return m ? m[1].trim() : '';
  };
  const tldrRaw = section('摘要').split('\n').find((l) => l.trim()) ?? '';
  const points = section('亮点')
    .split('\n')
    .filter((l) => /^\s*[-*•]\s+/.test(l))
    .map((l) => stripMd(l.replace(/^\s*[-*•]\s+/, '')))
    .filter(Boolean)
    .slice(0, 5);
  const tags = (raw.match(/#\s*[^\s#，。,、]{1,12}/g) ?? [])
    .map((t) => stripMd(t))
    .filter((t) => t && !/^(摘要|亮点|思考|术语)/.test(t))
    .slice(0, 5);
  const domain = guessDomain(fallbackTitle, tags, raw);
  const density = points.length;
  return {
    title: fallbackTitle,
    domain,
    tldr: stripMd(tldrRaw).slice(0, 80) || '暂无一句话精华',
    points: points.length ? points : [stripMd(tldrRaw) || '见原始总结'],
    tags: tags.length ? tags : [domain],
    verdict: density >= 3 ? '建议回看' : '摘要足够',
    verdictReason:
      density >= 3 ? '要点较密集，建议晚间花 3 分钟过一遍更划算。' : '信息密度不高，浏览摘要即可掌握大意。',
  };
}

/** 关键词粗分领域（模式 B 兜底） */
export function guessDomain(title: string, tags: string[], corpus: string): string {
  const text = `${title} ${tags.join(' ')} ${corpus.slice(0, 400)}`;
  const rules: Array<[string, RegExp]> = [
    ['AI与效率', /AI|人工智能|大模型|GPT|提示词|效率工具/i],
    ['职场成长', /职场|汇报|老板|面试|简历|管理|沟通/],
    ['心理', /心理|焦虑|情绪|拖延|习惯|认知/],
    ['音乐', /音乐|歌曲|编曲|混音|歌单|乐器/],
    ['科技', /编程|代码|开发|算法|数码|开源/],
    ['商业', /商业|创业|投资|经济|市场|金融/],
    ['学习', /学习|考试|读书|英语|笔记|教程/],
    ['健康', /健康|健身|运动|养生|饮食/],
    ['生活', /美食|旅行|生活|vlog|穿搭/i],
  ];
  for (const [name, re] of rules) if (re.test(text)) return name;
  return '其他';
}

export const CARD_MODE_INFO: Record<CardMode, { label: string; desc: string }> = {
  1: {
    label: '单次 · 智能卡',
    desc: '一次调用直接产出结构化卡片，省额度、速度快（推荐）',
  },
  2: {
    label: '单次 · 简洁卡',
    desc: '默认总结 + 本地解析，卡片从简，保留原始总结全文',
  },
  3: {
    label: '两次 · 精制卡',
    desc: '先总结再由 AI 精修成卡片，两次调用、内容更打磨',
  },
};

export const cardEmoji = (domain: string) => domainStyle(domain).emoji;
export const cardColor = (domain: string) => domainStyle(domain).color;
