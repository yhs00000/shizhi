/**
 * 拾知 · 短视频知识片段二次处理工具（黑客松版）
 * 基于 BibiGPT 开放 API：解析视频 → 知识卡片 → 知识树 → 每日 20% 精选推送
 */
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { T } from './src/theme';
import { actions, back, go, loadStore, useAppState, useScreen } from './src/store';
import { handleNotificationResponse, rescheduleDaily } from './src/notify';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import TreeScreen from './src/screens/TreeScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import MeScreen from './src/screens/MeScreen';
import RecordsScreen from './src/screens/RecordsScreen';

const TABS: Array<{ id: 'home' | 'review' | 'tree' | 'me'; icon: string; label: string }> = [
  { id: 'home', icon: '🏠', label: '首页' },
  { id: 'review', icon: '🕘', label: '复习' },
  { id: 'tree', icon: '🌳', label: '知识树' },
  { id: 'me', icon: '👤', label: '我的' },
];

export default function App() {
  const [screen, detailId, detailFrom] = useScreen();
  const appState = useAppState();
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1900);
  };

  useEffect(() => {
    loadStore().then(() => setReady(true));
    const sub = handleNotificationResponse();
    return () => sub.remove();
  }, []);

  // 卡片或提醒设置变化时，重排每日 20% 精选推送
  useEffect(() => {
    if (ready) rescheduleDaily(appState.cards, appState.settings);
  }, [ready, appState.cards, appState.settings.remindEnabled, appState.settings.remindTime]);

  // 安卓硬件返回键：钻取页面（详情/日历）退回来源页，而不是直接退出
  useEffect(() => {
    if (screen !== 'detail' && screen !== 'records') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [screen]);

  // 引导页中按返回键 = 跳过引导进入 App（可回退，不困住用户）
  useEffect(() => {
    if (appState.settings.onboarded) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      actions.updateSettings({ onboarded: true });
      return true;
    });
    return () => sub.remove();
  }, [appState.settings.onboarded]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={[styles.shell, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: T.muted }}>加载中…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // 未完成接入引导：全屏引导页（无底部导航，完成/跳过后进入正常界面）
  if (!appState.settings.onboarded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.shell} edges={['top', 'bottom']}>
          <StatusBar style="dark" />
          <OnboardingScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // 详情页高亮来源页签（知识树/复习/首页），日历高亮「我的」
  const tabOf = screen === 'detail' ? (detailFrom ?? 'home') : screen === 'records' ? 'me' : screen;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.shell} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
          {screen === 'home' && <HomeScreen onToast={showToast} />}
          {screen === 'detail' && <DetailScreen cardId={detailId} onToast={showToast} />}
          {screen === 'tree' && <TreeScreen />}
          {screen === 'review' && <ReviewScreen onToast={showToast} />}
          {screen === 'me' && <MeScreen onToast={showToast} />}
          {screen === 'records' && <RecordsScreen />}
        </View>

        <View style={styles.nav}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.id} style={styles.navBtn} onPress={() => go(t.id)} activeOpacity={0.7}>
              <Text style={{ fontSize: 20 }}>{t.icon}</Text>
              <Text style={[styles.navLabel, tabOf === t.id && styles.navLabelOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: T.bg },
  nav: {
    height: 60, flexDirection: 'row', backgroundColor: T.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.line,
  },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navLabel: { fontSize: 10.5, fontWeight: '600', color: T.muted },
  navLabelOn: { color: T.greenM, fontWeight: '800' },
  toast: {
    position: 'absolute', left: 40, right: 40, bottom: 84, backgroundColor: T.greenD,
    borderRadius: 24, paddingVertical: 10, alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
