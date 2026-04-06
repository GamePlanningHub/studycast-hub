import { json, requireAdmin } from "../../_shared.js";

// DELETE /api/transcript/{repo}/{segmentId} — 세그먼트 원본 복원
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const key = `transcript:${params.repo}/${params.segmentId}`;
  await env.STUDYCAST_DATA.delete(key);
  return json({ ok: true });
}
