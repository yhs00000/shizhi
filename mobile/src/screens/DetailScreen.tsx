import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T, shadow } from '../theme';
import { actions, back, go, useAppState } from '../store';
import { cardColor, cardEmoji } from '../card';

const fmtDur = (sec?: number) => (sec ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '');

export default function DetailScreen({ cardId, onToast }: { cardId: string | null; onToast: (m: string) => void }) {
  const { cards } = useAppState();
  const card = cards.find((c) => c.id === cardId) ?? null;

  if (!card) {
    return (
      <View style={[s.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: T.muted }}>卡片不存在或已删除</Text>
        <TouchableOpacity onPress={() => go('home')} style={{ marginTop: 12 }}>
          <Text style={{ color: T.greenM, fontWeight: '700' }}>返回首页</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = [card.domain, fmtDur(card.durationSec), card.author ? `@${card.author}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.wrap}>
      <View style={s.appbar}>
        <TouchableOpacity onPress={() => back()} style={s.backBtn} hitSlop={10}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>知识卡片</Text>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={[s.cov, { backgroundColor: T.greenD }, shadow(2)]}>
          <Text style={{ fontSize: 34, marginBottom: 8 }}>{cardEmoji(card.domain)}</Text>
          <Text style={s.covTitle}>{card.title}</Text>
          <Text style={s.covMeta}>{meta}</Text>
        </View>

        <View style={[s.verdict, { borderColor: card.verdict === '建议回看' ? T.gold : T.tealL }]}>
          <Text style={[s.vb, { color: card.verdict === '建议回看' ? T.gold : T.greenM }]}>{card.verdict}</Text>
          <Text style={s.vt}>{card.verdictReason}</Text>
        </View>

        <View style={[s.card, shadow(1)]}>
          <View style={s.ctRow}>
            <View style={[s.ctBar, { backgroundColor: T.gold }]} />
            <Text style={s.ct}>一句话精华</Text>
          </View>
          <Text style={s.tl}>{card.tldr}</Text>
        </View>

        <View style={[s.card, shadow(1)]}>
          <View style={s.ctRow}>
            <View style={[s.ctBar, { backgroundColor: T.greenM }]} />
            <Text style={s.ct}>核心要点</Text>
          </View>
          {card.points.map((p, i) => (
            <View key={i} style={[s.ptRow, i === card.points.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.dot} />
              <Text style={s.pt}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={[s.card, shadow(1)]}>
          <View style={s.ctRow}>
            <View style={[s.ctBar, { backgroundColor: T.greenM }]} />
            <Text style={s.ct}>智能标签</Text>
          </View>
          <View style={s.tags}>
            {card.tags.map((t) => (
              <Text key={t} style={s.tagChip}>{t}</Text>
            ))}
          </View>
        </View>

        <View style={s.acts}>
          {card.stored ? (
            <TouchableOpacity
              style={s.btnLine}
              onPress={() =>
                Alert.alert('移出知识树？', '卡片仍保留在首页收藏与复习中，可随时重新存入。', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '移出',
                    onPress: () => {
                      actions.setStored(card.id, false);
                      onToast('已从知识树移除');
                    },
                  },
                ])
              }
            >
              <Text style={s.btnLineText}>移出知识树</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => {
                actions.setStored(card.id, true);
                onToast('已归入知识树 🌳');
                setTimeout(() => go('tree'), 600);
              }}
            >
              <Text style={s.btnPrimaryText}>存入知识树</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.btnLine} onPress={() => Linking.openURL(card.url).catch(() => onToast('无法打开链接'))}>
            <Text style={s.btnLineText}>回看原视频</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.deleteBtn}
          onPress={() =>
            Alert.alert('彻底删除这张卡片？', '卡片及其原始总结将从本机移除，不可恢复。', [
              { text: '取消', style: 'cancel' },
              {
                text: '删除',
                style: 'destructive',
                onPress: () => {
                  back(); // 先退回上一级（列表/图谱），再删数据，避免闪「卡片不存在」帧
                  actions.removeCard(card.id);
                  onToast('卡片已删除');
                },
              },
            ])
          }
        >
          <Text style={s.deleteText}>删除这张卡片</Text>
        </TouchableOpacity>

        {!!card.rawSummary && (
          <View style={[s.card, shadow(1)]}>
            <View style={s.ctRow}>
              <View style={[s.ctBar, { backgroundColor: T.tealL }]} />
              <Text style={s.ct}>原始总结</Text>
            </View>
            <Text style={[s.tl, { fontSize: 12.5, color: T.muted }]} selectable>
              {card.rawSummary}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  appbar: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    backgroundColor: T.surface, ...shadow(1),
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 30, color: T.ink, marginTop: -4 },
  title: { fontSize: 16, fontWeight: '800', color: T.ink },
  body: { flex: 1, padding: 16 },
  cov: { borderRadius: T.radius.lg, padding: 16, minHeight: 130, justifyContent: 'flex-end' },
  covTitle: { fontSize: 17, fontWeight: '900', color: '#fff', marginBottom: 4 },
  covMeta: { fontSize: 12, color: '#cfe6dd' },
  verdict: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(217,154,31,.10)',
    borderWidth: 1, borderRadius: T.radius.md, padding: 10, paddingHorizontal: 12, marginVertical: 14,
  },
  vb: { fontSize: 12, fontWeight: '800' },
  vt: { flex: 1, fontSize: 12.5, color: T.inkSoft, lineHeight: 18 },
  card: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 15, paddingHorizontal: 16, marginBottom: 13 },
  ctRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  ctBar: { width: 4, height: 14, borderRadius: 3 },
  ct: { fontSize: 13, fontWeight: '800', color: T.ink },
  tl: { fontSize: 13.5, color: T.inkSoft, lineHeight: 24 },
  ptRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.line },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.greenM, marginTop: 6 },
  pt: { flex: 1, fontSize: 13, color: T.inkSoft, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagChip: {
    fontSize: 11.5, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 20,
    backgroundColor: T.bg2, color: T.greenM, fontWeight: '700', overflow: 'hidden',
  },
  acts: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnPrimary: { flex: 1, backgroundColor: T.greenM, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnStored: { backgroundColor: T.bg2 },
  btnPrimaryText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  btnLine: {
    flex: 1, borderWidth: 1.4, borderColor: T.tealL, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  btnLineText: { color: T.greenM, fontSize: 13.5, fontWeight: '700' },
  deleteBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: '#b34a4a', fontSize: 13, fontWeight: '700' },
});
