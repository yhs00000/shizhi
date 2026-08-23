import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { T, shadow } from '../theme';
import { actions, go, push, todayCards, useAppState } from '../store';
import { createCard, expandUrl, isShortLink } from '../api';
import { CARD_MODE_INFO, cardEmoji } from '../card';
import { extractUrl } from '../text';

// 模块级剪贴板检测状态：首页被切走/重挂载时不重置，保证「每次进入 App 只弹一次」
const clipGuard = {
  asked: new Set<string>(), // 同一链接本次运行只问一次
  inFlight: false, // 并发锁：上一次检测未完成前不重入
  booted: false, // 冷启动检测只排程一次
};

export default function HomeScreen({ onToast }: { onToast: (m: string) => void }) {
  const { cards, settings } = useAppState();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');

  // ---- 剪贴板检测：冷启动一次 + 每次从后台重新进入一次，绝不重叠加弹 ----
  useEffect(() => {
    const check = async () => {
      if (clipGuard.inFlight) return;
      clipGuard.inFlight = true;
      try {
        const raw = await Clipboard.getStringAsync();
        const text = extractUrl(raw); // 分享文案混合口令也能提取出纯链接
        if (!text) return; // 没识别到链接，静默
        if (clipGuard.asked.has(text)) return; // 问过的链接，静默
        clipGuard.asked.add(text);
        Alert.alert('检测到剪贴板链接', text.length > 80 ? text.slice(0, 80) + '…' : text, [
          { text: '忽略', style: 'cancel' },
          { text: '填入', onPress: () => setUrl(text) },
        ]);
      } catch {
        /* 系统拒绝时静默 */
      } finally {
        clipGuard.inFlight = false;
      }
    };
    if (!clipGuard.booted) {
      clipGuard.booted = true;
      setTimeout(check, 600); // 冷启动进入：检测一次
    }
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check()); // 重新进入：再检测一次
    return () => sub.remove();
  }, []);

  const parse = async () => {
    const link = extractUrl(url); // 支持粘贴整段分享文案，自动裁出纯链接
    if (!link) return onToast('没有识别到链接，请检查后重试');
    if (link !== url.trim()) {
      setUrl(link); // 界面同步显示裁切后的干净链接
      onToast('已从分享文案中提取链接');
    }

    // 内容审查：同一视频已存在则不再解析/添加，直接跳到已有卡片
    const dup = actions.hasDuplicate(link);
    if (dup) {
      onToast('这条内容已经收过啦，直接打开它 📌');
      push('detail', dup.id);
      return;
    }

    if (!settings.token.trim()) {
      Alert.alert('缺少 API Token', '请先到「我的」页填写 BibiGPT Token', [
        { text: '取消', style: 'cancel' },
        { text: '去填写', onPress: () => go('me') },
      ]);
      return;
    }
    setBusy(true);
    try {
      let finalUrl = link;
      if (isShortLink(link)) {
        setStage('检测到短链，正在展开…');
        const expanded = await expandUrl(settings.token.trim(), link);
        if (expanded !== link) {
          finalUrl = expanded;
          setUrl(expanded);
          onToast('短链已展开');
        }
        // 短链展开后再做一次内容审查：不同短链可能指向同一视频
        const dup2 = actions.hasDuplicate(finalUrl);
        if (dup2) {
          onToast('这条内容已经收过啦，直接打开它 📌');
          push('detail', dup2.id);
          return;
        }
      }
      setStage('AI 解析视频内容…');
      const card = await createCard(settings.token.trim(), finalUrl, settings.cardMode);
      setStage('生成知识卡片…');
      // 落库前最后一道审查（防止解析期间已有人手动添加了同一内容）
      const res = actions.addCard(card);
      if (!res.added && res.existing) {
        onToast('内容重复，已为你打开原有卡片 📌');
        push('detail', res.existing.id);
        return;
      }
      setUrl('');
      push('detail', card.id);
    } catch (e: any) {
      Alert.alert('解析失败', e?.message ?? String(e));
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const today = todayCards(cards);
  const digestRate = cards.length ? Math.round((cards.filter((c) => c.stored).length / cards.length) * 100) : 0;

  return (
    <View style={s.wrap}>
      <View style={s.appbar}>
        <Text style={s.title}>拾知</Text>
        <Text style={s.sub}> · 短视频知识寄存</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.modeTag}>{CARD_MODE_INFO[settings.cardMode].label}</Text>
      </View>

      <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
        <View style={[s.hero, shadow(2)]}>
          <Text style={s.heroH}>把刷到的知识，寄存在这里</Text>
          <Text style={s.heroP}>粘贴 B 站/YouTube/文件直链，AI 帮你提炼、归类、晚上提醒回看。</Text>
          <TextInput
            style={s.linkbox}
            value={url}
            onChangeText={setUrl}
            placeholder="粘贴链接，或整段分享文案（自动提取链接）"
            placeholderTextColor={T.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy}
          />
          <TouchableOpacity
            style={[s.btnPrimary, busy && { opacity: 0.6 }]}
            onPress={parse}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.btnPrimaryText}>{stage || '处理中…'}</Text>
              </View>
            ) : (
              <Text style={s.btnPrimaryText}>粘贴链接，AI 解析成卡</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.stats}>
          <View style={[s.chip, shadow(1)]}>
            <Text style={s.chipN}>{today.length}</Text>
            <Text style={s.chipL}>今日收集</Text>
          </View>
          <View style={[s.chip, shadow(1)]}>
            <Text style={s.chipN}>{cards.length}</Text>
            <Text style={s.chipL}>累计知识</Text>
          </View>
          <View style={[s.chip, shadow(1)]}>
            <Text style={s.chipN}>{digestRate}%</Text>
            <Text style={s.chipL}>消化率</Text>
          </View>
        </View>

        <View style={s.secRow}>
          <View style={s.secBar} />
          <Text style={s.sec}>最近收集</Text>
        </View>

        {cards.length === 0 && (
          <Text style={s.empty}>还没有收藏，从上方解析第一条视频开始 🌱</Text>
        )}
        {cards.slice(0, 20).map((c) => (
          <TouchableOpacity key={c.id} style={[s.mini, shadow(1)]} onPress={() => push('detail', c.id)} activeOpacity={0.85}>
            <View style={[s.miniCov, { backgroundColor: T.greenD }]}>
              <Text style={{ fontSize: 19 }}>{cardEmoji(c.domain)}</Text>
            </View>
            <View style={s.miniBody}>
              <Text style={s.miniT} numberOfLines={1}>{c.title}</Text>
              <Text style={s.miniSub}>
                {c.domain}
                {c.durationSec ? ` · ${Math.round(c.durationSec / 60)} 分钟` : ''}
              </Text>
            </View>
            <Text style={[s.tag, c.stored ? s.tagMuted : s.tagGold]}>{c.stored ? '已入树' : c.verdict}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  appbar: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: T.surface, ...shadow(1),
  },
  title: { fontSize: 19, fontWeight: '800', color: T.ink },
  sub: { fontSize: 12, color: T.muted, fontWeight: '500' },
  modeTag: {
    fontSize: 11, color: T.greenM, borderWidth: 1, borderColor: T.tealL,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, fontWeight: '600',
  },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },
  hero: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 15 },
  heroH: { fontSize: 16, fontWeight: '800', color: T.ink, marginBottom: 3 },
  heroP: { fontSize: 12.5, color: T.muted, lineHeight: 19, marginBottom: 11 },
  linkbox: {
    backgroundColor: T.bg2, borderWidth: 1.4, borderStyle: 'dashed', borderColor: T.tealL,
    borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, color: T.inkSoft, marginBottom: 11,
  },
  btnPrimary: { backgroundColor: T.greenM, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  chip: { flex: 1, backgroundColor: T.surface, borderRadius: T.radius.md, paddingVertical: 11, alignItems: 'center' },
  chipN: { fontSize: 18, fontWeight: '900', color: T.greenM, lineHeight: 20 },
  chipL: { fontSize: 11, color: T.muted, marginTop: 4 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 9, marginLeft: 2 },
  secBar: { width: 4, height: 15, borderRadius: 3, backgroundColor: T.gold },
  sec: { fontSize: 13, fontWeight: '800', color: T.ink },
  empty: { textAlign: 'center', color: T.muted, fontSize: 12.5, marginVertical: 24 },
  mini: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: T.surface,
    borderRadius: T.radius.md, padding: 10, paddingHorizontal: 12, marginBottom: 9,
  },
  miniCov: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  miniBody: { flex: 1, minWidth: 0 },
  miniT: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  miniSub: { fontSize: 11, color: T.muted, marginTop: 2 },
  tag: { fontSize: 10.5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontWeight: '700', overflow: 'hidden' },
  tagGold: { backgroundColor: T.gold, color: '#fff' },
  tagMuted: { borderWidth: 1, borderColor: T.line, color: T.muted },
});
