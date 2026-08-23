/** 拾知设计令牌 —— 取自原型 拾知_安卓原型_v3.html 的 CSS 变量 */
export const T = {
  greenD: '#0e4a3c', // 深绿 - 结构性/标题
  greenM: '#1f7a5e', // 主绿 - 主操作/品牌
  greenL: '#2f8f76', // 中绿
  tealL: '#c3dfd8', // 浅青绿
  gold: '#d99a1f', // 金黄 - 唯一暖色点缀
  goldL: '#f3dca0',
  surface: '#ffffff',
  bg: '#eef4f1',
  bg2: '#e4efe9',
  line: '#dce8e2',
  ink: '#16302a',
  inkSoft: '#33514a',
  muted: '#6b7d76',
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
};

/** 阴影近似原型 e1/e2/e4（RN 无 CSS 阴影，用 elevation+shadow props 简化） */
export const shadow = (level: 1 | 2 | 4 = 1) =>
  ({
    shadowColor: T.greenD,
    shadowOpacity: 0.08 * level,
    shadowRadius: 3 * level,
    shadowOffset: { width: 0, height: level },
    elevation: level * 2,
  }) as const;

/** 领域 → 主题色与图标（AI 生成领域名时做关键词匹配兜底） */
export const DOMAIN_STYLE: Array<{ keys: string[]; color: string; emoji: string }> = [
  { keys: ['AI', 'ai', '人工智能', '大模型', 'GPT', '效率', '工具'], color: T.greenL, emoji: '🤖' },
  { keys: ['职场', '汇报', '工作', '管理', '沟通', '求职'], color: T.greenM, emoji: '💼' },
  { keys: ['心理', '情绪', '焦虑', '习惯', '认知'], color: T.gold, emoji: '🧠' },
  { keys: ['音乐', '艺术', '设计', '影视', '文学'], color: '#7a5fc0', emoji: '🎵' },
  { keys: ['科技', '编程', '代码', '数码', '互联网', '产品'], color: '#2f6f8f', emoji: '💻' },
  { keys: ['商业', '经济', '投资', '创业', '金融'], color: '#8a6d3b', emoji: '📈' },
  { keys: ['学习', '考试', '读书', '英语', '教育'], color: '#3c8a5a', emoji: '📚' },
  { keys: ['健康', '运动', '养生', '医'], color: '#c05f6e', emoji: '🏃' },
  { keys: ['生活', '美食', '旅行', 'vlog'], color: '#b07830', emoji: '🌿' },
];

export const domainStyle = (domain: string) => {
  const hit = DOMAIN_STYLE.find((d) => d.keys.some((k) => domain.includes(k)));
  return hit ?? { color: T.greenD, emoji: '✨' };
};
