/**
 * 首次接入引导：欢迎 → 去获取 Token → 粘贴 → getMe 验证 → 进入
 * 回退：「稍后再说」或安卓返回键都会跳过引导直接进 App（首页已有空 token 兜底提示）
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { T, shadow } from '../theme';
import { getMe } from '../api';
import { actions } from '../store';

const TOKEN_PAGE = 'https://bibigpt.co/user/integration';

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; email: string | null; tier: string; minutes: number }
  | { kind: 'fail'; message: string };

export default function OnboardingScreen() {
  const [token, setToken] = useState('');
  const [verify, setVerify] = useState<VerifyState>({ kind: 'idle' });

  const pasteFromClipboard = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) {
      setToken(text);
      setVerify({ kind: 'idle' });
    }
  };

  const verifyAndEnter = async () => {
    const t = token.trim();
    if (!t) {
      setVerify({ kind: 'fail', message: '请先粘贴 Token' });
      return;
    }
    setVerify({ kind: 'checking' });
    try {
      const me = await getMe(t);
      actions.updateSettings({ token: t });
      setVerify({
        kind: 'ok',
        email: me?.email ?? null,
        tier: me?.plan?.tier ?? 'free',
        minutes: Math.round(me?.remainingMinutes ?? 0),
      });
    } catch (e: any) {
      setVerify({ kind: 'fail', message: e?.message ?? '验证失败' });
    }
  };

  const enter = () => actions.updateSettings({ onboarded: true });

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.emoji}>🌱</Text>
      <Text style={s.title}>欢迎使用拾知</Text>
      <Text style={s.sub}>
        拾知通过 BibiGPT 开放 API 把短视频解析成知识卡片。{'\n'}接入你自己的 API Token 即可开始使用——
        Token 是 BibiGPT 分配给你账号的一串密钥，解析时长从你的账号额度扣除。
      </Text>

      <View style={[s.card, shadow(1)]}>
        <Text style={s.step}>第 1 步 · 获取 Token</Text>
        <TouchableOpacity style={s.btnGhost} onPress={() => Linking.openURL(TOKEN_PAGE)}>
          <Text style={s.btnGhostText}>🔗 去 BibiGPT 获取 Token</Text>
        </TouchableOpacity>
        <Text style={s.hint}>在打开的页面登录/注册 BibiGPT，复制你的 API Token 后回到这里</Text>

        <Text style={[s.step, { marginTop: 18 }]}>第 2 步 · 粘贴 Token</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={token}
            onChangeText={(t) => {
              setToken(t);
              setVerify({ kind: 'idle' });
            }}
            placeholder="粘贴你的 Token"
            placeholderTextColor={T.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <TouchableOpacity style={s.pasteBtn} onPress={pasteFromClipboard}>
            <Text style={s.pasteBtnText}>📋 粘贴</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.step, { marginTop: 18 }]}>第 3 步 · 验证</Text>
        <TouchableOpacity
          style={[s.btnMain, verify.kind === 'checking' && { opacity: 0.6 }]}
          onPress={verifyAndEnter}
          disabled={verify.kind === 'checking'}
        >
          {verify.kind === 'checking' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnMainText}>验证连接</Text>
          )}
        </TouchableOpacity>

        {verify.kind === 'ok' && (
          <View style={s.okBox}>
            <Text style={s.okText}>
              ✅ 连接成功{verify.email ? `（${verify.email}）` : ''}
              {'\n'}剩余额度约 {verify.minutes} 分钟 · 套餐 {verify.tier}
            </Text>
            <TouchableOpacity style={s.btnMain} onPress={enter}>
              <Text style={s.btnMainText}>进入拾知 →</Text>
            </TouchableOpacity>
          </View>
        )}
        {verify.kind === 'fail' && (
          <Text style={s.failText}>❌ Token 无效，请检查是否复制完整{'\n'}{verify.message}</Text>
        )}
      </View>

      <TouchableOpacity onPress={enter} style={s.skip}>
        <Text style={s.skipText}>稍后再说，先随便逛逛 →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  content: { padding: 24, paddingBottom: 48 },
  emoji: { fontSize: 44, textAlign: 'center', marginTop: 24 },
  title: { fontSize: 24, fontWeight: '700', color: T.greenD, textAlign: 'center', marginTop: 8 },
  sub: { fontSize: 13, lineHeight: 21, color: T.inkSoft, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  card: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 18 },
  step: { fontSize: 14, fontWeight: '700', color: T.greenD, marginBottom: 8 },
  hint: { fontSize: 12, color: T.muted, marginTop: 8, lineHeight: 18 },
  btnGhost: {
    borderWidth: 1.5,
    borderColor: T.greenM,
    borderRadius: T.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnGhostText: { color: T.greenM, fontWeight: '700', fontSize: 14 },
  btnMain: {
    backgroundColor: T.greenM,
    borderRadius: T.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnMainText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: T.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: T.ink,
    backgroundColor: T.bg,
  },
  pasteBtn: {
    backgroundColor: T.tealL,
    borderRadius: T.radius.md,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  pasteBtnText: { color: T.greenD, fontWeight: '700', fontSize: 13 },
  okBox: { marginTop: 14, gap: 10 },
  okText: { fontSize: 13, color: T.greenM, fontWeight: '600', lineHeight: 20 },
  failText: { marginTop: 12, fontSize: 12, color: '#c0392b', lineHeight: 18 },
  skip: { marginTop: 24, alignItems: 'center' },
  skipText: { color: T.muted, fontSize: 13 },
});
