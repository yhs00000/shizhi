import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T, shadow } from '../theme';
import { actions, pickTonight, push, todayCards, useAppState } from '../store';
import { CardItem, todayStr } from '../types';

export default function ReviewScreen({ onToast }: { onToast: (m: string) => void }) {
  const { cards, records } = useAppState();
  const picks = pickTonight(cards);
  const pickIds = new Set(picks.map((p) => p.id));
  const todayAll = todayCards(cards);
  const rest = todayAll.filter((c) => !pickIds.has(c.id));
  const doneToday = records.includes(todayStr());

  const dateLabel = `${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日`;

  const renderCard = (c: CardItem, isPick: boolean) => (
    <TouchableOpacity key={c.id} style={[s.card, shadow(1)]} activeOpacity={0.85} onPress={() => push('detail', c.id)}>
      <View style={s.ctRow}>
        <View style={[s.ctBar, { backgroundColor: c.verdict === '建议回看' ? T.gold : T.greenM }]} />
        <Text style={s.ct}>
          {c.verdict} · {c.domain}
        </Text>
        {isPick && <Text style={s.pickTag}>重点推荐</Text>}
      </View>
      <Text style={s.tl}>
        <Text style={{ fontWeight: '800', color: T.ink }}>{c.title}</Text>
        {'\n'}
        {c.verdictReason}
      </Text>
      <TouchableOpacity
        style={[s.storeBtn, c.stored && s.storeBtnDone]}
        disabled={c.stored}
        onPress={() => {
          actions.setStored(c.id, true);
          onToast('已存入知识树 🌳');
        }}
      >
        <Text style={[s.storeBtnText, c.stored && { color: T.muted }]}>
          {c.stored ? '已存入 ✓' : '存入知识树'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={s.wrap}>
      <View style={s.appbar}>
        <Text style={s.title}>晚间复习</Text>
        <View style={{ flex: 1 }} />
        {doneToday && <Text style={s.doneTag}>今日已打卡 ✓</Text>}
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={[s.digest, shadow(1)]}>
          <Text style={s.digestD}>今晚 · {dateLabel}</Text>
          <Text style={s.digestBig}>
            {picks.length ? `为你挑出 ${picks.length} 条值得回看` : '今天还没有收藏'}
          </Text>
          <Text style={s.digestSub}>
            {picks.length
              ? `规则：当日收藏 × 20%（今日共 ${todayAll.length} 条，未入树的优先），全部收藏见下方`
              : '去首页解析一条视频，今晚就有得复习 🌱'}
          </Text>
        </View>

        {picks.length > 0 && <SectionLabel text="重点推荐" />}
        {picks.map((c) => renderCard(c, true))}

        {rest.length > 0 && <SectionLabel text={`今日收藏 · 共 ${todayAll.length} 条`} />}
        {rest.map((c) => renderCard(c, false))}
      </ScrollView>

      <View style={s.foot}>
        <TouchableOpacity
          style={[s.btnPrimary, (doneToday || !picks.length) && { opacity: 0.5 }]}
          disabled={doneToday || !picks.length}
          onPress={() => {
            actions.checkInToday();
            onToast('今日回顾完成，明天见 🌿');
          }}
        >
          <Text style={s.btnPrimaryText}>{doneToday ? '今日已完成' : '完成今日回顾'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const SectionLabel = ({ text }: { text: string }) => (
  <View style={s.secRow}>
    <View style={s.secBar} />
    <Text style={s.sec}>{text}</Text>
  </View>
);

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  appbar: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: T.surface, ...shadow(1),
  },
  title: { fontSize: 16, fontWeight: '800', color: T.ink },
  doneTag: { fontSize: 11.5, color: T.greenM, fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  digest: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderLeftWidth: 4,
    borderLeftColor: T.greenM, borderRadius: T.radius.lg, padding: 16, paddingHorizontal: 18, marginBottom: 14,
  },
  digestD: { fontSize: 12.5, color: T.muted },
  digestBig: { fontSize: 18, fontWeight: '900', color: T.ink, marginTop: 3 },
  digestSub: { fontSize: 12, color: T.inkSoft, marginTop: 6, lineHeight: 18 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 10, marginLeft: 2 },
  secBar: { width: 4, height: 14, borderRadius: 3, backgroundColor: T.gold },
  sec: { fontSize: 13, fontWeight: '800', color: T.ink },
  card: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 15, paddingHorizontal: 16, marginBottom: 13 },
  ctRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  ctBar: { width: 4, height: 14, borderRadius: 3 },
  ct: { fontSize: 13, fontWeight: '800', color: T.ink },
  pickTag: {
    marginLeft: 'auto', fontSize: 10.5, fontWeight: '800', color: '#fff', backgroundColor: T.gold,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden',
  },
  tl: { fontSize: 13, color: T.inkSoft, lineHeight: 21 },
  storeBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: T.greenM, borderRadius: 12,
    paddingVertical: 9, alignItems: 'center',
  },
  storeBtnDone: { backgroundColor: T.bg2, borderColor: T.line },
  storeBtnText: { color: T.greenM, fontSize: 13.5, fontWeight: '800' },
  foot: { padding: 12, paddingHorizontal: 16, backgroundColor: T.surface, ...shadow(2) },
  btnPrimary: { backgroundColor: T.greenM, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
