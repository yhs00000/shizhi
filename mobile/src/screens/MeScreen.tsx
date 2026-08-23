import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { T, shadow } from '../theme';
import { actions, push, useAppState } from '../store';
import { CardMode } from '../types';
import { CARD_MODE_INFO } from '../card';
import { ensurePermission, sendTestNow } from '../notify';

const TIME_OPTIONS = ['20:00', '21:00', '22:00', '23:00'];

export default function MeScreen({ onToast }: { onToast: (m: string) => void }) {
  const { cards, settings, records } = useAppState();
  const domains = new Set(cards.filter((c) => c.stored).map((c) => c.domain)).size;
  const weekAgo = Date.now() - 7 * 86400000;
  const weekDigested = cards.filter((c) => c.stored && c.createdAt > weekAgo).length;

  const setMode = (m: CardMode) => {
    actions.updateSettings({ cardMode: m });
    onToast(`制卡模式已切换：${CARD_MODE_INFO[m].label}`);
  };

  const pickModeUI = (m: CardMode) => (
    <TouchableOpacity
      key={m}
      style={[s.modeItem, settings.cardMode === m && s.modeItemOn]}
      onPress={() => setMode(m)}
      activeOpacity={0.8}
    >
      <View style={[s.radio, settings.cardMode === m && s.radioOn]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.modeLabel, settings.cardMode === m && { color: T.greenM }]}>{CARD_MODE_INFO[m].label}</Text>
        <Text style={s.modeDesc}>{CARD_MODE_INFO[m].desc}</Text>
      </View>
    </TouchableOpacity>
  );

  const onToggleRemind = async (val: boolean) => {
    if (val) {
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert('权限未开启', '请在系统设置中允许「拾知」发送通知');
        return;
      }
    }
    actions.updateSettings({ remindEnabled: val });
    onToast(val ? `已开启晚间复习提醒（${settings.remindTime}）` : '已关闭复习提醒');
  };

  const onSendTest = async () => {
    try {
      await sendTestNow(cards);
      onToast('已发送测试通知，请查看通知栏 🌿');
    } catch (e: any) {
      Alert.alert('发送失败', e?.message || '未知错误');
    }
  };

  return (
    <View style={s.wrap}>
      <View style={s.appbar}>
        <Text style={s.title}>我的</Text>
      </View>
      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={[s.set, shadow(1)]}>
          <Text style={s.setTitle}>BibiGPT API Token</Text>
          <TextInput
            style={s.input}
            value={settings.token}
            onChangeText={(t) => actions.updateSettings({ token: t })}
            placeholder="bibigpt.co/user/integration 获取，自动保存"
            placeholderTextColor={T.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        <View style={[s.set, shadow(1)]}>
          <Text style={s.setTitle}>制卡模式（可自由切换对比效果）</Text>
          {([1, 2, 3] as CardMode[]).map(pickModeUI)}
        </View>

        {/* 晚间复习提醒（EAS 开发构建恢复） */}
        <View style={[s.set, shadow(1)]}>
          <View style={s.row}>
            <Text style={s.rl}>晚间复习提醒（每日 20% 精选推送）</Text>
            <Switch
              value={settings.remindEnabled}
              onValueChange={onToggleRemind}
              trackColor={{ false: T.line, true: T.greenM }}
              thumbColor={T.surface}
            />
          </View>
          {settings.remindEnabled && (
            <>
              <View style={s.row}>
                <Text style={s.rl}>提醒时间</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {TIME_OPTIONS.map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[s.timeChip, settings.remindTime === time && s.timeChipOn]}
                      onPress={() => {
                        actions.updateSettings({ remindTime: time });
                        onToast(`提醒时间已设为 ${time}`);
                      }}
                    >
                      <Text style={[s.timeChipText, settings.remindTime === time && { color: '#fff' }]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={s.testBtn} onPress={onSendTest} activeOpacity={0.7}>
                <Text style={s.testBtnText}>🔔 立即发送一条测试通知</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={[s.set, shadow(1)]}>
          <View style={s.row}><Text style={s.rl}>累计知识</Text><Text style={s.riStrong}>{cards.length} 条</Text></View>
          <View style={s.row}><Text style={s.rl}>本周消化</Text><Text style={s.riStrong}>{weekDigested} 条</Text></View>
          <View style={s.row}><Text style={s.rl}>知识树领域</Text><Text style={s.ri}>{domains} 个</Text></View>
        </View>

        <View style={[s.set, shadow(1)]}>
          <TouchableOpacity style={s.row} onPress={() => push('records')}>
            <Text style={s.rl}>过往记录</Text>
            <Text style={s.ri}>已打卡 {records.length} 天 ›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.row}
            onPress={() =>
              Alert.alert('清空全部数据？', '将删除所有知识卡片与打卡记录（Token 保留）', [
                { text: '取消', style: 'cancel' },
                { text: '清空', style: 'destructive', onPress: () => { actions.clearAll(); onToast('已清空'); } },
              ])
            }
          >
            <Text style={[s.rl, { color: '#b34a4a' }]}>清空数据</Text>
            <Text style={s.ri}>›</Text>
          </TouchableOpacity>
          <View style={s.row}><Text style={s.rl}>关于拾知</Text><Text style={s.ri}>v1.0 黑客松版</Text></View>
        </View>
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
  title: { fontSize: 16, fontWeight: '800', color: T.ink },
  body: { flex: 1, padding: 16 },
  set: { backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 13, overflow: 'hidden', paddingVertical: 4 },
  setTitle: { fontSize: 12.5, fontWeight: '800', color: T.muted, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  input: {
    marginHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: T.line,
    borderRadius: 10, padding: 10, fontSize: 13, color: T.ink,
  },
  modeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: T.line,
  },
  modeItemOn: { backgroundColor: T.bg2 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: T.tealL },
  radioOn: { borderColor: T.greenM, backgroundColor: T.greenM },
  modeLabel: { fontSize: 14, fontWeight: '700', color: T.ink },
  modeDesc: { fontSize: 11.5, color: T.muted, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: T.line,
  },
  rl: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink },
  ri: { fontSize: 12, color: T.muted },
  riStrong: { fontSize: 12, color: T.greenM, fontWeight: '800' },
  warnText: {
    fontSize: 11.5, color: T.gold, lineHeight: 17,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  timeChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, borderColor: T.tealL,
  },
  timeChipOn: { backgroundColor: T.greenM, borderColor: T.greenM },
  timeChipText: { fontSize: 12, fontWeight: '700', color: T.greenM },
  testBtn: { margin: 12, borderWidth: 1.4, borderColor: T.tealL, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  testBtnText: { color: T.greenM, fontSize: 13, fontWeight: '700' },
});
