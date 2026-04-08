import { json, requireAdmin } from "../../_shared.js";

// POST /api/admin/bulb-cleanup — 일회성 정리 엔드포인트
// edit:* KV 값에서 과거 전구 SVG(.note-icon div)를 모두 제거한다.
// 완료 후 이 파일은 삭제할 것. (기술부채 방지)
export async function onRequestPost(context) {
  const { request, env } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun === true;

  // <div class="note-icon">...</div> 전체 제거 (non-greedy)
  const bulbRegex = /<div class="note-icon">[\s\S]*?<\/div>/g;

  const summary = {
    dryRun,
    scanned: 0,
    matched: 0,
    modified: 0,
    totalBulbsRemoved: 0,
    keys: [],
  };

  let cursor = undefined;
  while (true) {
    const listResult = await env.STUDYCAST_DATA.list({
      prefix: "edit:",
      cursor,
    });
    for (const keyInfo of listResult.keys) {
      summary.scanned++;
      const raw = await env.STUDYCAST_DATA.get(keyInfo.name);
      if (!raw) continue;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof parsed.content !== "string") continue;
      const matches = parsed.content.match(bulbRegex);
      if (!matches || matches.length === 0) continue;

      summary.matched++;
      summary.totalBulbsRemoved += matches.length;
      summary.keys.push({ key: keyInfo.name, bulbs: matches.length });

      if (!dryRun) {
        parsed.content = parsed.content.replace(bulbRegex, "");
        parsed.updatedAt = new Date().toISOString();
        await env.STUDYCAST_DATA.put(keyInfo.name, JSON.stringify(parsed));
        summary.modified++;
      }
    }
    if (listResult.list_complete) break;
    cursor = listResult.cursor;
    if (!cursor) break;
  }

  return json(summary);
}
