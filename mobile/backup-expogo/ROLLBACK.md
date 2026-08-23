# 回退说明（Expo Go 无通知版）

`backup-expogo/` 是本次 EAS Development Build 改造前的完整快照，对应「Expo Go 可跑、通知下架」的版本。

## 包含文件
| 备份文件 | 恢复目标 |
|---|---|
| `app.json` | `app.json` |
| `package.json` | `package.json` |
| `App.tsx` | `App.tsx` |
| `notify.ts` | `src/notify.ts` |
| `MeScreen.tsx` | `src/screens/MeScreen.tsx` |

## 一键回退

```bash
cd bibigpt-pack/mobile
cp backup-expogo/app.json     app.json
cp backup-expogo/package.json package.json
cp backup-expogo/App.tsx      App.tsx
cp backup-expogo/notify.ts    src/notify.ts
cp backup-expogo/MeScreen.tsx src/screens/MeScreen.tsx
npm install        # 按旧 package.json 还原依赖（卸掉 notifications/dev-client）
npx expo start     # 回到 Expo Go
```

回退后可删除 `eas.json`（不影响 Expo Go）。
