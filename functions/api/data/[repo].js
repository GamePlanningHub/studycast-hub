import { json, isAdmin } from "../_shared.js";

// GET /api/data/{repo} — 해당 강의의 모든 수정+메모 일괄 조회
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const repo = params.repo;
  const admin = isAdmin(request, env);

  const [editKeys, memoKeys] = await Promise.all([
    env.STUDYCAST_DATA.list({ prefix: `edit:${repo}/` }),
    env.STUDYCAST_DATA.list({ prefix: `memo:${repo}/` }),
  ]);

  const edits = {};
  const memos = {};

  const editPromises = editKeys.keys.map(async (k) => {
    const val = await env.STUDYCAST_DATA.get(k.name, "json");
    if (val) edits[k.name.split("/").pop()] = val;
  });
  const memoPromises = memoKeys.keys.map(async (k) => {
    const val = await env.STUDYCAST_DATA.get(k.name, "json");
    if (val) memos[k.name.split("/").pop()] = val;
  });

  await Promise.all([...editPromises, ...memoPromises]);
  return json({ edits, memos, isAdmin: admin });
}
