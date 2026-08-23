/**
 * 同一视频去重：把各种形态的链接（短链、带跟踪参数、www/m 子域、https/http）
 * 归一到「内容键」，相同键视为同一内容。无法归一时返回 null（不拦截）。
 */
export function contentKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  let path = u.pathname.replace(/\/+$/, '');

  // B 站：BV 号是内容唯一标识（av 号少见，退化为路径）
  if (host === 'bilibili.com' || host === 'b23.tv') {
    const bv = path.match(/\/(BV[0-9A-Za-z]{10})/i);
    if (bv) return `bili:${bv[1]}`;
    return `bili:${host}${path}`;
  }

  // YouTube：v 参数（watch/shorts 都归到 video id）
  if (host === 'youtube.com') {
    const v = u.searchParams.get('v');
    if (v) return `yt:${v}`;
    const s = path.match(/^\/shorts\/([^/?]+)/);
    if (s) return `yt:${s[1]}`;
    return `yt:${path}`;
  }
  if (host === 'youtu.be') return `yt:${path.replace(/^\//, '')}`;

  // 常见短链：域名+路径本身就是内容键（同一视频短链不变）
  const SHORT = ['xhslink.cn', 'v.douyin.com', 't.cn', 'dwz.cn', 'url.cn'];
  if (SHORT.some((s) => host === s || host.endsWith(`.${s}`))) return `short:${host}${path}`;

  // 通用兜底：去掉跟踪参数，只保留 host + path
  return `u:${host}${path}${u.search ? stableSearch(u.searchParams) : ''}`;
}

/** 去掉 utm/spm 等跟踪参数后按字母序拼回（相同内容不同分享参数的兜底归一） */
function stableSearch(sp: URLSearchParams): string {
  const keep: string[] = [];
  sp.forEach((v, k) => {
    if (/^(utm_|spm|vd_source|feature|si|igsh|x-)/i.test(k)) return;
    keep.push(`${k}=${v}`);
  });
  keep.sort();
  return keep.length ? `?${keep.join('&')}` : '';
}
