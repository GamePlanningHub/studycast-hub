import { json, requireAdmin } from "../../_shared.js";

// PUT /api/mapping/{repo}/{sectionId} — 매핑 오버레이 저장 (관리자만)
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.start !== "number" || typeof body.end !== "number") {
    return json({ error: "start/end must be numbers" }, 400);
  }
  if (!(body.start >= 0) || !(body.end > body.start)) {
    return json({ error: "invalid range: require start >= 0 and end > start" }, 400);
  }

  const key = `mapping:${params.repo}/${params.sectionId}`;
  const value = {
    start: body.start,
    end: body.end,
    updatedAt: new Date().toISOString(),
  };
  await env.STUDYCAST_DATA.put(key, JSON.stringify(value));
  return json({ ok: true, updatedAt: value.updatedAt });
}

// DELETE /api/mapping/{repo}/{sectionId} — 매핑 오버레이 삭제 (원본 복원)
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const key = `mapping:${params.repo}/${params.sectionId}`;
  await env.STUDYCAST_DATA.delete(key);
  return json({ ok: true });
}
