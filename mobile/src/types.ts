export type ScreenId = 'home' | 'detail' | 'tree' | 'review' | 'me' | 'records';

/** 制卡模式：1=单次智能卡 2=单次简洁卡 3=两次精制卡 */
export type CardMode = 1 | 2 | 3;

export interface CardItem {
  id: string;
  createdAt: number;
  url: string;
  title: string;
  domain: string; // AI 归类的领域名
  tldr: string; // 一句话精华
  points: string[]; // 核心要点
  tags: string[]; // 智能标签
  verdict: '建议回看' | '摘要足够';
  verdictReason: string;
  durationSec?: number;
  author?: string;
  rawSummary?: string; // 原始总结备份
  stored: boolean; // 是否已存入知识树
  mode: CardMode;
}

export interface Settings {
  token: string;
  cardMode: CardMode;
  remindEnabled: boolean;
  remindTime: string; // "HH:MM"
}

export interface AppState {
  cards: CardItem[];
  settings: Settings;
  records: string[]; // "YYYY-MM-DD" 打卡日期
}

export const DEFAULT_SETTINGS: Settings = {
  // 黑客松演示机预填的 BibiGPT Token（「我的」页仍可编辑、自动保存覆盖）
  // 注意：此值会打进安装包，正式分发前请移除
  token: 'BS708N9DBRKX',
  cardMode: 1,
  remindEnabled: true,
  remindTime: '21:00',
};

export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
