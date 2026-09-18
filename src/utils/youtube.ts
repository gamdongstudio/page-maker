/**
 * YouTube 주소 → 영상 번호와 모양.
 * shorts 주소면 세로(9:16), 나머지는 가로(16:9). 알아볼 수 없는 주소면 null (표시하지 않는다).
 */
export function youtubeOf(url?: string): { id: string; shorts: boolean } | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  const m =
    u.match(/youtube\.com\/shorts\/([\w-]{6,})/) ? { id: RegExp.$1, shorts: true }
    : u.match(/youtu\.be\/([\w-]{6,})/) ? { id: RegExp.$1, shorts: false }
    : u.match(/[?&]v=([\w-]{6,})/) ? { id: RegExp.$1, shorts: false }
    : u.match(/youtube\.com\/(?:embed|live)\/([\w-]{6,})/) ? { id: RegExp.$1, shorts: false }
    : null;
  return m;
}
