import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { CardItem, Settings } from './types';
import { pickTonight, go } from './store';

/**
 * 通知模块（EAS Development Build 版）
 * SDK 53+ 的 Expo Go 移除了 expo-notifications 原生实现；开发构建后恢复完整能力。
 * 若需在 Expo Go 中回退，见 backup-expogo/notify.ts。
 */
export const notificationsAvailable = true;

// 前台收到通知时仍弹出横幅 + 声音
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'daily-review';
const DAILY_ID = 'shizhi-daily-review';

export async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  if (!req.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '晚间复习提醒',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return true;
}

/** 通知标题/正文（与复习页同一套挑选结果） */
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

/** 按设置重排每日提醒：先取消旧的每日提醒，再按 remindTime 挂每日重复触发 */
export async function rescheduleDaily(cards: CardItem[], settings: Settings) {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  if (!settings.remindEnabled) return;
  const content = tonightContent(cards);
  if (!content) return;
  if (!(await ensurePermission())) return;

  const [h, m] = (settings.remindTime || '21:00').split(':').map((x) => parseInt(x, 10));
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      data: { target: 'review' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Number.isFinite(h) ? h : 21,
      minute: Number.isFinite(m) ? m : 0,
    },
  });
}

/** 监听通知点击：回到复习页。返回订阅对象供卸载 */
export function handleNotificationResponse() {
  return Notifications.addNotificationResponseReceivedListener(() => {
    go('review');
  });
}

/** 立即发一条今晚精选（「我的」页测试按钮用） */
export async function sendTestNow(cards: CardItem[]): Promise<void> {
  if (!(await ensurePermission())) throw new Error('通知权限未授予');
  const content = tonightContent(cards);
  if (!content) throw new Error('暂无可推送的知识卡片');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      data: { target: 'review' },
    },
    trigger: null, // 立即触发
  });
}
