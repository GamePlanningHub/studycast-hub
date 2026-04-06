import { json, requireAdmin } from "../../_shared.js";

// PUT /api/memo/{repo}/{sectionId} — 메모 저장
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json();
  if (typeof body.text !== "string") {
    return json({ error: "text required" }, 400);
  }

  const key = `memo:${params.repo}/${params.sectionId}`;
  const value = { text: body.text, updatedAt: new Date().toISOString() };
  await env.STUDYCAST_DATA.put(key, JSON.stringify(value));
  return json({ ok: true, ...value });
}

// DELETE /api/memo/{repo}/{sectionId} — 메모 삭제
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const key = `memo:${params.repo}/${params.sectionId}`;
  await env.STUDYCAST_DATA.delete(key);
  return json({ ok: true });
}
