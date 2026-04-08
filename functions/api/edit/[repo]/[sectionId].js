import { json, requireAdmin } from "../../_shared.js";

// HTML 스냅샷 → 검색용 평문 (태그 제거 + 공백 정규화)
function htmlToSearchText(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// searchidx:{repo} KV 부분 갱신 (한 섹션 단위)
async function updateSearchIdx(env, repo, sectionId, text) {
  const key = `searchidx:${repo}`;
  const existing = (await env.STUDYCAST_DATA.get(key, "json")) || {};
  if (text) {
    existing[sectionId] = text;
  } else {
    delete existing[sectionId];
  }
  if (Object.keys(existing).length === 0) {
    await env.STUDYCAST_DATA.delete(key);
  } else {
    await env.STUDYCAST_DATA.put(key, JSON.stringify(existing));
  }
}

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
  if (typeof body.title === "string") value.title = body.title;
  await env.STUDYCAST_DATA.put(key, JSON.stringify(value));

  // 검색 인덱스 오버레이 갱신 (실패해도 본 저장은 성공 처리)
  try {
    const searchText = htmlToSearchText(
      (value.title ? value.title + " " : "") + body.content
    );
    await updateSearchIdx(env, params.repo, params.sectionId, searchText);
  } catch (e) {
    console.error("searchidx update failed", e);
  }

  return json({ ok: true, ...value });
}

// DELETE /api/edit/{repo}/{sectionId} — 수정 삭제 (원본 복원)
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const key = `edit:${params.repo}/${params.sectionId}`;
  await env.STUDYCAST_DATA.delete(key);

  // 검색 오버레이에서도 해당 섹션 제거
  try {
    await updateSearchIdx(env, params.repo, params.sectionId, "");
  } catch (e) {
    console.error("searchidx delete failed", e);
  }

  return json({ ok: true });
}
