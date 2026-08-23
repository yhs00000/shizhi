import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { T, shadow } from '../theme';
import { push, useAppState } from '../store';
import { cardColor } from '../card';
import { CardItem } from '../types';

/* ============ 图谱视图状态（模块级：离开页面再回来也保持 列表/图谱 与聚焦态） ============ */
let savedViewMode: 'graph' | 'list' = 'graph';
let savedFocus: string | null = null;

/* ================= 布局常量与工具 ================= */
const PAD = 18;
const DIM = { fill: '#eef1f0', stroke: '#d7ddda', text: '#a0aaa6', link: '#e3e9e6' };
const textW = (s: string, fs: number) => s.length * fs + 4; // 中文≈1em 宽
const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

interface GNode {
  key: string;
  kind: 'root' | 'domain' | 'card';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  lines: string[];
  sub?: string;
  color: string;
  domain?: string;
  card?: CardItem;
}

/** 标题拆行：每行最多 7 字、最多两行，超出省略 */
function splitTitle(t: string): string[] {
  if (t.length <= 7) return [t];
  const rest = t.slice(7, 14);
  return [t.slice(0, 7), t.length > 14 ? rest + '…' : rest];
}

function buildLayout(domList: Array<[string, CardItem[]]>, storedCount: number) {
  const nodes: GNode[] = [];
  const domCount = Math.max(domList.length, 1);
  const DOM_R = Math.max(120, domCount * 26);
  const LEAF_R = DOM_R + 120;
  const C = { x: 0, y: 0 }; // 先以原点布局，最后按包围盒平移

  domList.forEach(([domain, items], i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / domCount;
    const dColor = cardColor(domain);
    const dW = Math.max(88, textW(domain, 12.5) + 30);
    nodes.push({
      key: `d:${domain}`, kind: 'domain',
      x: C.x + Math.cos(a) * DOM_R, y: C.y + Math.sin(a) * DOM_R,
      w: dW, h: 44, label: domain, lines: [trim(domain, 8)], sub: `${items.length} 张`,
      color: dColor, domain,
    });

    const spread = Math.min(Math.PI * 0.6, Math.max(0, items.length - 1) * 0.32);
    items.forEach((c, j) => {
      const off = items.length === 1 ? 0.16 : -spread / 2 + (spread * j) / (items.length - 1);
      const lines = splitTitle(c.title);
      const w = Math.max(80, Math.max(...lines.map((l) => textW(l, 11))) + 20);
      nodes.push({
        key: `c:${c.id}`, kind: 'card',
        x: C.x + Math.cos(a + off) * LEAF_R, y: C.y + Math.sin(a + off) * LEAF_R,
        w, h: 50, label: c.title, lines, sub: c.tags[0] ? trim(c.tags[0], 8) : undefined,
        color: cardColor(c.domain), domain: c.domain, card: c,
      });
    });
  });

  nodes.push({ key: 'root', kind: 'root', x: C.x, y: C.y, w: 116, h: 50, label: '我的知识库', lines: ['我的知识库'], sub: `${storedCount} 条`, color: T.greenD });

  // 重叠消解：推挤至收敛（最多 200 轮）
  for (let iter = 0; iter < 200; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i];
        const B = nodes[j];
        const ox = Math.min(A.x + A.w / 2 + 6, B.x + B.w / 2 + 6) - Math.max(A.x - A.w / 2 - 6, B.x - B.w / 2 - 6);
        const oy = Math.min(A.y + A.h / 2 + 6, B.y + B.h / 2 + 6) - Math.max(A.y - A.h / 2 - 6, B.y - B.h / 2 - 6);
        if (ox > 0 && oy > 0) {
          moved = true;
          let dx = B.x - A.x;
          let dy = B.y - A.y;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { dx = (i - j) * 0.5 || 0.5; dy = 0.3; }
          if (ox < oy) {
            const p = Math.sign(dx) * (ox / 2 + 1);
            A.x -= p;
            B.x += p;
          } else {
            const p = Math.sign(dy) * (oy / 2 + 1);
            A.y -= p;
            B.y += p;
          }
        }
      }
    }
    if (!moved) break;
  }

  // 按内容包围盒定画布，节点平移到正坐标（保证无裁切、无重叠）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.w / 2);
    minY = Math.min(minY, n.y - n.h / 2);
    maxX = Math.max(maxX, n.x + n.w / 2);
    maxY = Math.max(maxY, n.y + n.h / 2);
  });
  const offX = PAD - minX;
  const offY = PAD - minY;
  nodes.forEach((n) => { n.x += offX; n.y += offY; });
  const canvas = { w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
  return { nodes, canvas };
}

interface CrossLink { a: string; b: string; strength: number }

/** 跨域关联：不同领域卡片共享智能标签 → 金色虚线（每卡≤2 条，全图≤6 条） */
function buildCrossLinks(stored: CardItem[]): CrossLink[] {
  const pairs: CrossLink[] = [];
  for (let i = 0; i < stored.length; i++) {
    for (let j = i + 1; j < stored.length; j++) {
      const A = stored[i];
      const B = stored[j];
      if (A.domain === B.domain) continue;
      const at = new Set(A.tags.map((t) => t.trim().toLowerCase()));
      const shared = B.tags.filter((t) => at.has(t.trim().toLowerCase())).length;
      if (shared > 0) pairs.push({ a: `c:${A.id}`, b: `c:${B.id}`, strength: shared });
    }
  }
  pairs.sort((x, y) => y.strength - x.strength);
  const used = new Map<string, number>();
  const out: CrossLink[] = [];
  for (const p of pairs) {
    if (out.length >= 6) break;
    if ((used.get(p.a) ?? 0) >= 2 || (used.get(p.b) ?? 0) >= 2) continue;
    used.set(p.a, (used.get(p.a) ?? 0) + 1);
    used.set(p.b, (used.get(p.b) ?? 0) + 1);
    out.push(p);
  }
  return out;
}

export default function TreeScreen() {
  const { cards } = useAppState();
  const [viewMode, setViewModeState] = useState<'graph' | 'list'>(savedViewMode);
  const [focusDom, setFocusDomState] = useState<string | null>(savedFocus);
  const setViewMode = (m: 'graph' | 'list') => { savedViewMode = m; setViewModeState(m); };
  const setFocusDom = (d: string | null) => { savedFocus = d; setFocusDomState(d); };
  const stored = useMemo(() => cards.filter((c) => c.stored), [cards]);

  const domList = useMemo(() => {
    const m = new Map<string, CardItem[]>();
    stored.forEach((c) => {
      const arr = m.get(c.domain) ?? [];
      arr.push(c);
      m.set(c.domain, arr);
    });
    return [...m.entries()];
  }, [stored]);

  const { nodes, canvas } = useMemo(() => buildLayout(domList, stored.length), [domList, stored.length]);
  const crossLinks = useMemo(() => buildCrossLinks(stored), [stored]);
  const byKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  /* ---------- 单指拖动 / 双指缩放 ---------- */
  const tfRef = useRef({ x: 0, y: 0, k: 1 });
  const [tf, setTf] = useState(tfRef.current);
  const gest = useRef<{ mode: 'pan' | 'pinch' | null; sx: number; sy: number; tx: number; ty: number; d0: number; k0: number }>({ mode: null, sx: 0, sy: 0, tx: 0, ty: 0, d0: 0, k0: 1 });
  const applyTf = (next: { x: number; y: number; k: number }) => {
    tfRef.current = next;
    setTf(next);
  };

  const onTouchStart = (e: any) => {
    const ts = e.nativeEvent.touches;
    if (ts.length === 1) {
      gest.current = { mode: 'pan', sx: ts[0].pageX, sy: ts[0].pageY, tx: tfRef.current.x, ty: tfRef.current.y, d0: 0, k0: tfRef.current.k };
    } else if (ts.length === 2) {
      gest.current = {
        mode: 'pinch',
        sx: 0, sy: 0, tx: 0, ty: 0,
        d0: Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY),
        k0: tfRef.current.k,
      };
    }
  };
  const onTouchMove = (e: any) => {
    const ts = e.nativeEvent.touches;
    const g = gest.current;
    if (g.mode === 'pan' && ts.length === 1) {
      applyTf({ x: g.tx + ts[0].pageX - g.sx, y: g.ty + ts[0].pageY - g.sy, k: tfRef.current.k });
    } else if (g.mode === 'pinch' && ts.length === 2) {
      const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
      if (g.d0 > 0) {
        const k = Math.min(3, Math.max(0.4, g.k0 * (d / g.d0)));
        applyTf({ x: tfRef.current.x, y: tfRef.current.y, k });
      }
    }
  };
  const onTouchEnd = (e: any) => {
    if (e.nativeEvent.touches.length === 0) gest.current.mode = null;
  };

  const onCanvasLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (gest.current.mode !== null) return;
    const k = Math.min(1, (width - 16) / canvas.w, (height - 16) / canvas.h);
    applyTf({ x: (width - canvas.w * k) / 2, y: (height - canvas.h * k) / 2, k });
  };

  /** 聚焦点亮集合 */
  const lit = useMemo(() => {
    if (!focusDom) return null;
    const set = new Set<string>(['root', `d:${focusDom}`]);
    stored.filter((c) => c.domain === focusDom).forEach((c) => set.add(`c:${c.id}`));
    crossLinks.forEach(({ a, b }) => {
      const A = byKey.get(a);
      const B = byKey.get(b);
      if ((A?.domain === focusDom || B?.domain === focusDom) && A && B) {
        set.add(a);
        set.add(b);
        if (A.domain) set.add(`d:${A.domain}`);
        if (B.domain) set.add(`d:${B.domain}`);
      }
    });
    return set;
  }, [focusDom, stored, crossLinks, byKey]);

  const isDim = (key: string) => (lit ? !lit.has(key) : false);
  const isLinkDim = (a: string, b: string) => (lit ? !(lit.has(a) && lit.has(b)) : false);
  const isLinkHot = (a: string, b: string) => (lit ? lit.has(a) && lit.has(b) : false);

  const bezier = (A: GNode, B: GNode, curve: number) => {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * curve;
    const py = (dx / len) * curve;
    return `M${A.x} ${A.y} C ${A.x + dx * 0.35 + px} ${A.y + dy * 0.35 + py}, ${A.x + dx * 0.65 + px} ${A.y + dy * 0.65 + py}, ${B.x} ${B.y}`;
  };

  return (
    <View style={s.wrap}>
      <View style={s.appbar}>
        <Text style={s.title}>我的知识树</Text>
        <View style={{ flex: 1 }} />
        <View style={s.toggle}>
          {(['graph', 'list'] as const).map((m) => (
            <TouchableOpacity key={m} style={[s.tBtn, viewMode === m && s.tBtnOn]} onPress={() => setViewMode(m)}>
              <Text style={[s.tBtnText, viewMode === m && s.tBtnTextOn]}>{m === 'graph' ? '图谱' : '列表'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {viewMode === 'list' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
          {cards.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 38, marginBottom: 12 }}>🌱</Text>
              <Text style={s.emptyT}>还没有任何卡片</Text>
              <Text style={s.emptyP}>去首页解析一条视频开始收藏。</Text>
            </View>
          ) : (
            cards.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[s.lRow, shadow(1)]}
                onPress={() => push('detail', c.id)}
                activeOpacity={0.85}
              >
                <View style={[s.lCov, { backgroundColor: cardColor(c.domain) }]} />
                <View style={s.lBody}>
                  <Text style={s.lT} numberOfLines={1}>{c.title}</Text>
                  <Text style={s.lS}>
                    {c.domain}
                    {c.durationSec ? ` · ${Math.round(c.durationSec / 60)} 分钟` : ''}
                  </Text>
                </View>
                <Text style={[s.lTag, c.stored ? s.lTagStored : s.lTagGold]}>{c.stored ? '已入树' : c.verdict}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : stored.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 38, marginBottom: 12 }}>🌱</Text>
          <Text style={s.emptyT}>知识树还是空的</Text>
          <Text style={s.emptyP}>在卡片详情点「存入知识树」，{'\n'}知识会生长到这里。</Text>
        </View>
      ) : (
        <>
          <View
            style={s.canvasBox}
            onLayout={onCanvasLayout}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <View style={{ transform: [{ translateX: tf.x }, { translateY: tf.y }, { scale: tf.k }] }}>
              <Svg width={canvas.w} height={canvas.h}>
                <Rect x={0} y={0} width={canvas.w} height={canvas.h} fill="transparent" onPress={() => setFocusDom(null)} />

                {/* 树边：根→领域、领域→卡片 */}
                {nodes.map((n) => {
                  if (n.kind === 'card') {
                    const d = byKey.get(`d:${n.domain}`)!;
                    const dim = isLinkDim(n.key, d.key);
                    const hot = isLinkHot(n.key, d.key);
                    return (
                      <Path key={`${d.key}-${n.key}`} d={bezier(d, n, 16)} fill="none"
                        stroke={dim ? DIM.link : hot ? T.gold : T.tealL} strokeWidth={hot ? 2.4 : 1.8} />
                    );
                  }
                  if (n.kind === 'domain') {
                    const r = byKey.get('root')!;
                    const dim = isLinkDim(n.key, 'root');
                    const hot = focusDom === n.domain;
                    return (
                      <Path key={`root-${n.key}`} d={bezier(r, n, 16)} fill="none"
                        stroke={dim ? DIM.link : hot ? T.gold : T.tealL} strokeWidth={hot ? 2.8 : 2.2} opacity={dim ? 0.8 : 0.95} />
                    );
                  }
                  return null;
                })}

                {/* 跨域关联虚线 */}
                {crossLinks.map((lk) => {
                  const A = byKey.get(lk.a);
                  const B = byKey.get(lk.b);
                  if (!A || !B) return null;
                  const dim = isLinkDim(lk.a, lk.b);
                  const hot = isLinkHot(lk.a, lk.b);
                  return (
                    <Path key={`${lk.a}-${lk.b}`} d={bezier(A, B, 34)} fill="none"
                      stroke={dim ? DIM.link : T.gold} strokeWidth={hot ? 1.8 : 1.3}
                      strokeDasharray="4 4" opacity={dim ? 0.7 : hot ? 0.95 : 0.75} />
                  );
                })}

                {/* 节点（无 emoji，文字完整显示） */}
                {nodes.map((n) => {
                  if (n.kind === 'root') {
                    return (
                      <G key={n.key}>
                        <Rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={16} fill={n.color} />
                        <SvgText x={n.x} y={n.y - 2} fontSize={14} fontWeight="800" fill="#fff" textAnchor="middle">
                          {n.label}
                        </SvgText>
                        <SvgText x={n.x} y={n.y + 16} fontSize={10.5} fill="#cfe6dd" textAnchor="middle">
                          {n.sub}
                        </SvgText>
                      </G>
                    );
                  }
                  if (n.kind === 'domain') {
                    const focused = focusDom === n.domain;
                    const dim = isDim(n.key);
                    return (
                      <G key={n.key} onPress={() => setFocusDom(focused ? null : n.domain ?? null)}>
                        <Rect
                          x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={12}
                          fill={focused ? n.color : dim ? DIM.fill : '#fff'}
                          stroke={focused ? n.color : dim ? DIM.stroke : n.color} strokeWidth={2}
                        />
                        <SvgText x={n.x} y={n.y} fontSize={12.5} fontWeight="800" textAnchor="middle"
                          fill={focused ? '#fff' : dim ? DIM.text : T.ink}>
                          {n.lines[0]}
                        </SvgText>
                        <SvgText x={n.x} y={n.y + 15} fontSize={9.5} textAnchor="middle"
                          fill={focused ? 'rgba(255,255,255,.85)' : dim ? DIM.text : T.muted}>
                          {n.sub}
                        </SvgText>
                      </G>
                    );
                  }
                  const dim = isDim(n.key);
                  return (
                    <G key={n.key} onPress={() => n.card && push('detail', n.card.id)}>
                      <Rect
                        x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={12}
                        fill={dim ? DIM.fill : '#fff'} stroke={dim ? DIM.stroke : n.color} strokeWidth={2}
                      />
                      {n.lines.map((line, idx) => (
                        <SvgText key={idx} x={n.x} y={n.y - (n.lines.length === 1 ? 3 : 9) + idx * 13} fontSize={11}
                          fontWeight="700" textAnchor="middle" fill={dim ? DIM.text : T.ink}>
                          {line}
                        </SvgText>
                      ))}
                      {!!n.sub && (
                        <SvgText x={n.x} y={n.y + (n.lines.length === 1 ? 12 : 18)} fontSize={8.5} textAnchor="middle"
                          fill={dim ? DIM.text : T.muted}>
                          {n.sub}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </Svg>
            </View>
          </View>

          <View style={[s.legend, shadow(1)]}>
            <Text style={s.legendH}>AI 识别领域 · 自动关联</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 }}>
              {domList.map(([d]) => (
                <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[s.legendDot, { backgroundColor: cardColor(d) }]} />
                  <Text style={s.legendText}>{d}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[s.legendDot, { backgroundColor: T.gold }]} />
                <Text style={s.legendText}>虚线 = 跨域关联</Text>
              </View>
            </View>
          </View>
          <Text style={s.guide}>单指拖动 · 双指缩放 · 点领域聚焦关联 · 点卡片看详情</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  appbar: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: T.surface, ...shadow(1),
  },
  title: { fontSize: 16, fontWeight: '800', color: T.ink },
  toggle: { flexDirection: 'row', backgroundColor: T.bg2, borderRadius: 17, padding: 3, gap: 3 },
  tBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14 },
  tBtnOn: { backgroundColor: T.surface, ...shadow(1) },
  tBtnText: { fontSize: 12, fontWeight: '700', color: T.muted },
  tBtnTextOn: { color: T.greenM },
  canvasBox: { flex: 1, overflow: 'hidden' },
  lRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: T.surface,
    borderRadius: T.radius.md, padding: 10, paddingHorizontal: 12, marginBottom: 9,
  },
  lCov: { width: 10, height: 40, borderRadius: 6 },
  lBody: { flex: 1, minWidth: 0 },
  lT: { fontSize: 13.5, fontWeight: '700', color: T.ink },
  lS: { fontSize: 11, color: T.muted, marginTop: 2 },
  lTag: { fontSize: 10.5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontWeight: '700', overflow: 'hidden' },
  lTagStored: { backgroundColor: T.greenM, color: '#fff' },
  lTagGold: { backgroundColor: T.gold, color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyT: { fontSize: 14.5, fontWeight: '800', color: T.inkSoft, marginBottom: 7 },
  emptyP: { fontSize: 12.5, color: T.muted, lineHeight: 20, textAlign: 'center' },
  legend: {
    marginHorizontal: 12, backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 10, paddingHorizontal: 12,
  },
  legendH: { fontSize: 11, fontWeight: '800', color: T.ink },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 10.5, color: T.inkSoft },
  guide: { fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 6, marginBottom: 8 },
});
