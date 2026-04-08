import { json } from "./_shared.js";

// GET /api/searchidx — 모든 강의의 편집 오버레이 텍스트 일괄 조회
// 응답: { "{repo}": "section1 text section2 text ..." }
// 런처가 정적 search-index.json 위에 덮어 합쳐서 검색에 사용
export async function onRequestGet(context) {
  const { env } = context;
  const out = {};

  let cursor = undefined;
  const allKeys = [];
  do {
    const page = await env.STUDYCAST_DATA.list({
      prefix: "searchidx:",
      cursor,
    });
    allKeys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  await Promise.all(
    allKeys.map(async (k) => {
      const repo = k.name.slice("searchidx:".length);
      const dict = await env.STUDYCAST_DATA.get(k.name, "json");
      if (dict && typeof dict === "object") {
        out[repo] = Object.values(dict).join(" ");
      }
    })
  );

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
