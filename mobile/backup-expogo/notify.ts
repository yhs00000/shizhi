import { CardItem, Settings } from './types';
import { pickTonight } from './store';

/**
 * 通知功能临时下架说明：
 * SDK 53+ 的 Expo Go 移除了 expo-notifications 原生实现，仅 import 即导致
 * "runtime not ready" 崩溃。为保证 Expo Go 里整体可用，当前版本完全移除
 * 该依赖，全部接口降级为空操作/不可用。
 *
 * 恢复方式：EAS 开发构建后重新安装 expo-notifications，并实现同签名的
 * ensurePermission / rescheduleDaily / handleNotificationResponse / sendTestNow。
 */
export const notificationsAvailable = false;

export const REMOVED_REASON =
  '当前为 Expo Go 运行环境（SDK 53+ 已移除通知能力）。晚间复习提醒将在正式构建版本中启用。';

export async function ensurePermission(): Promise<boolean> {
  return false;
}

/** 通知标题/正文（与复习页同一套挑选结果）——保留给将来恢复与界面复用 */
export function tonightContent(cards: CardItem[]) {
  const picks = pickTonight(cards);
  if (!picks.length) return null;
  const names = picks
    .slice(0, 3)
    .map((c) => `《${c.title}》`)
    .join('');
  return {
    n: picks.length,
    title: `今晚为你挑出 ${picks.length} 条值得回看`,
    body: names + (picks.length > 3 ? ' 等，点开去看看 🌿' : '，点开去看看 🌿'),
  };
}

/** Expo Go 环境为空操作；恢复后按计划重排每日提醒 */
export async function rescheduleDaily(_cards: CardItem[], _settings: Settings) {
  /* no-op */
}

/** Expo Go 环境为空订阅；恢复后监听通知点击直达复习页 */
export function handleNotificationResponse() {
  return { remove() {} };
}

export async function sendTestNow(_cards: CardItem[]): Promise<void> {
  throw new Error(REMOVED_REASON);
}
