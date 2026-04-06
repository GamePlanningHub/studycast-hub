import { json, requireAdmin } from "../../_shared.js";

// PUT /api/edit/{repo}/{sectionId} — 섹션 content 수정 저장
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json();
  if (typeof body.content !== "string") {
    return json({ error: "content required" }, 400);
  }

  const key = `edit:${params.repo}/${params.sectionId}`;
  const value = { content: body.content, updatedAt: new Date().toISOString() };
  await env.STUDYCAST_DATA.put(key, JSON.stringify(value));
  return json({ ok: true, ...value });
}

// DELETE /api/edit/{repo}/{sectionId} — 수정 삭제 (원본 복원)
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const key = `edit:${params.repo}/${params.sectionId}`;
  await env.STUDYCAST_DATA.delete(key);
  return json({ ok: true });
}
