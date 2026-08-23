/**
 * 从分享文案中提取纯链接。
 * 各平台分享文本通常是「标题 + https://短链 + 口令/尾巴」，如：
 *   「面试官：90%用户不用的功能… https://xhslink.cn/o/ADzmptpSEVd 存下口令，来【小红书】瞧瞧这篇~」
 * 规则：取第一个 http(s):// 起、到第一个非可见 ASCII（空格/中文等）为止，
 * 再剥掉常见尾随标点（口令场景下不会带这些）。
 */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[\x21-\x7e]+/i);
  if (!m) return null;
  const url = m[0].replace(/[.,;:!?)\]}'">，。；！？）》」』~…]+$/, '');
  return url || null;
}
