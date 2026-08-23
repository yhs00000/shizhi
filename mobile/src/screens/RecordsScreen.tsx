import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T, shadow } from '../theme';
import { back, useAppState } from '../store';
import { todayStr } from '../types';

const WK = ['日', '一', '二', '三', '四', '五', '六'];

export default function RecordsScreen() {
  const { records } = useAppState();
  const done = new Set(records);
  const today = todayStr();

  const renderMonth = (offset: number) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    const y = d.getFullYear();
    const mo = d.getMonth();
    const first = new Date(y, mo, 1).getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < first; i++) cells.push(<View key={`e${i}`} style={s.dot} />);
    let monthDone = 0;
    for (let day = 1; day <= days; day++) {
      const key = `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isDone = done.has(key);
      const isToday = key === today;
      if (isDone) monthDone++;
      cells.push(
        <View key={key} style={[s.dot, isDone && s.dotDone, isToday && s.dotToday]}>
          <Text style={[s.dotText, isDone && { color: '#fff', fontWeight: '800' }]}>{day}</Text>
        </View>,
      );
    }
    return (
      <View key={`${y}-${mo}`} style={s.calMonth}>
        <Text style={s.calTitle}>
          {y} 年 {mo + 1} 月 <Text style={{ fontWeight: '500', color: T.muted, fontSize: 11 }}>已打卡 {monthDone} 天</Text>
        </Text>
        <View style={s.grid}>{WK.map((w) => (
          <Text key={w} style={s.wk}>{w}</Text>
        ))}</View>
        <View style={s.grid}>{cells}</View>
      </View>
    );
  };

  return (
    <View style={s.wrap}>
      <View style={s.appbar}>
        <TouchableOpacity onPress={() => back()} style={s.backBtn} hitSlop={10}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>过往记录</Text>
      </View>
      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={s.tip}>每完成一次「今日回顾」即打卡一天。圆点越满，知识的根系越深 🌿</Text>
        {[1, 0].map(renderMonth)}
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
  tip: { fontSize: 12.5, color: T.muted, lineHeight: 20, marginBottom: 16 },
  calMonth: { marginBottom: 22 },
  calTitle: { fontSize: 14, fontWeight: '800', color: T.ink, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wk: { width: 32, textAlign: 'center', fontSize: 10, color: T.muted, marginBottom: 4 },
  dot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: T.bg2,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: T.greenM },
  dotToday: { borderWidth: 1.5, borderColor: T.greenM },
  dotText: { fontSize: 10, color: T.muted },
});
