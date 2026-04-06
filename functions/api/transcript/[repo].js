import { json, requireAdmin } from "../_shared.js";

// PUT /api/transcript/{repo} — 세그먼트 일괄 저장
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json();
  if (!Array.isArray(body.segments)) {
    return json({ error: "segments array required" }, 400);
  }

  const puts = body.segments.map((seg) => {
    const key = `transcript:${params.repo}/${seg.id}`;
    const value = JSON.stringify({
      text: seg.text,
      updatedAt: new Date().toISOString(),
    });
    return env.STUDYCAST_DATA.put(key, value);
  });

  await Promise.all(puts);
  return json({ ok: true, count: body.segments.length });
}
