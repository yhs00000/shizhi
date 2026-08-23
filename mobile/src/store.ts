import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, CardItem, DEFAULT_SETTINGS, ScreenId, Settings, todayStr } from './types';
import { contentKey } from './dedupe';

const KEYS = { cards: 'shizhi_cards', settings: 'shizhi_settings', records: 'shizhi_records' };

let state: AppState = { cards: [], settings: DEFAULT_SETTINGS, records: [] };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  AsyncStorage.setItem(KEYS.cards, JSON.stringify(state.cards)).catch(() => {});
  AsyncStorage.setItem(KEYS.settings, JSON.stringify(state.settings)).catch(() => {});
  AsyncStorage.setItem(KEYS.records, JSON.stringify(state.records)).catch(() => {});
}

export async function loadStore() {
  if (loaded) return;
  loaded = true;
  try {
    const [c, s, r] = await Promise.all([
      AsyncStorage.getItem(KEYS.cards),
      AsyncStorage.getItem(KEYS.settings),
      AsyncStorage.getItem(KEYS.records),
    ]);
    state = {
      cards: c ? JSON.parse(c) : [],
      settings: s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS,
      records: r ? JSON.parse(r) : [],
    };
    // 已保存的 token 为空时回落到预填默认 token（首次安装/被清空过的情况）
    if (!state.settings.token.trim()) {
      state.settings = { ...state.settings, token: DEFAULT_SETTINGS.token };
    }
  } catch {
    /* 首次启动或数据损坏时用默认值 */
  }
  emit();
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  persist();
  emit();
}

export const actions = {
  /**
   * 添加卡片；若同一内容已存在（同一 BV/YouTube id/短链/规范化 URL），
   * 返回已有卡片且不新增。调用方可据此提示用户并跳转。
   */
  addCard(card: CardItem): { added: boolean; existing: CardItem | null } {
    const key = contentKey(card.url);
    if (key) {
      const existing = state.cards.find((c) => contentKey(c.url) === key);
      if (existing) return { added: false, existing };
    }
    setState({ cards: [card, ...state.cards] });
    return { added: true, existing: null };
  },
  /** 是否已存在同一内容的卡片（用于发起解析前预检，省 API 额度） */
  hasDuplicate(url: string): CardItem | null {
    const key = contentKey(url);
    if (!key) return null;
    return state.cards.find((c) => contentKey(c.url) === key) ?? null;
  },
  setStored(id: string, stored: boolean) {
    setState({ cards: state.cards.map((c) => (c.id === id ? { ...c, stored } : c)) });
  },
  removeCard(id: string) {
    setState({ cards: state.cards.filter((c) => c.id !== id) });
  },
  updateSettings(patch: Partial<Settings>) {
    setState({ settings: { ...state.settings, ...patch } });
  },
  checkInToday() {
    const t = todayStr();
    if (!state.records.includes(t)) setState({ records: [...state.records, t] });
  },
  clearAll() {
    setState({ cards: [], records: [] });
  },
};

/* ---------- 派生数据 ---------- */

/** 今日收藏 */
export const todayCards = (cards: CardItem[]) => cards.filter((c) => todayStr(new Date(c.createdAt)) === todayStr());

/**
 * 20% 规则：当日全部收藏 × 20%，四舍五入，不足 5 张至少 1 张，0 张不选。
 * 挑选偏好：未存入知识树的优先（还没消化的先复习），同组内新卡优先。
 */
export function pickTonight(cards: CardItem[]): CardItem[] {
  const today = todayCards(cards);
  if (!today.length) return [];
  const n = Math.max(1, Math.round(today.length * 0.2));
  const sorted = [...today].sort((a, b) => Number(a.stored) - Number(b.stored) || b.createdAt - a.createdAt);
  return sorted.slice(0, n);
}

/* ---------- 界面导航（轻量状态机：页签切换 go / 钻取 push / 返回 back） ---------- */

let screen: ScreenId = 'home';
let detailId: string | null = null;
let navStack: ScreenId[] = []; // 钻取页面的来源栈，back() 逐级弹回
let detailFrom: ScreenId | null = null; // 当前详情页的来源页签（用于底部导航高亮）

export function useScreen(): [ScreenId, string | null, ScreenId | null] {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => screen,
    () => screen,
  );
  return [s, detailId, detailFrom];
}

/** 页签级切换（底部导航）：清空返回栈 */
export function go(to: ScreenId, cardId?: string) {
  navStack = [];
  detailFrom = null;
  screen = to;
  if (cardId !== undefined) detailId = cardId;
  emit();
}

/** 钻取级切换（卡片详情、打卡日历）：记住来源页 */
export function push(to: ScreenId, cardId?: string) {
  navStack.push(screen);
  if (to === 'detail') detailFrom = screen;
  screen = to;
  if (cardId !== undefined) detailId = cardId;
  emit();
}

/** 返回上一级；栈空时回首页 */
export function back() {
  screen = navStack.pop() ?? 'home';
  if (screen !== 'detail') detailFrom = null;
  emit();
}
