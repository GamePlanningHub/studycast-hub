import { json, isAdmin } from './_shared.js';

// 날짜 범위 계산
function getDateRange(period, dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (period === 'day') {
    return [dateStr, dateStr];
  }
  if (period === 'week') {
    // 월요일 기준
    const day = d.getUTCDay();
    const diff = day === 0 ? 6 : day - 1; // 월=0, 일=6
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() - diff);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    return [fmt(mon), fmt(sun)];
  }
  if (period === 'month') {
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return [fmt(first), fmt(last)];
  }
  return [dateStr, dateStr];
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

// 범위 내 모든 날짜 배열 생성
function datesBetween(start, end) {
  const dates = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur <= last) {
    dates.push(fmt(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// KV에서 특정 날짜의 로그 전체 수집 (cursor 페이징)
async function getLogsForDate(kv, dateStr) {
  const logs = [];
  let cursor = undefined;
  while (true) {
    const opts = { prefix: `log:${dateStr}:`, limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const list = await kv.list(opts);
    // 값은 list에 포함되지 않으므로 개별 get 필요
    const values = await Promise.all(
      list.keys.map(k => kv.get(k.name, 'json'))
    );
    values.forEach(v => { if (v) logs.push(v); });
    if (list.list_complete) break;
    cursor = list.cursor;
  }
  return logs;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // 관리자 체크
  if (!isAdmin(request, env)) {
    return json({ error: 'forbidden' }, 403);
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'day';
  const dateParam = url.searchParams.get('date') || fmt(new Date());

  if (!['day', 'week', 'month'].includes(period)) {
    return json({ error: 'invalid period' }, 400);
  }

  const [rangeStart, rangeEnd] = getDateRange(period, dateParam);
  const dates = datesBetween(rangeStart, rangeEnd);

  // manifest.json에서 강의 title 매핑
  let manifest = [];
  try {
    const mRes = await env.ASSETS.fetch(new Request('https://dummy/manifest.json'));
    if (mRes.ok) manifest = await mRes.json();
  } catch (e) {}
  const titleMap = {};
  manifest.forEach(m => { titleMap[m.folder] = m.title; });

  // 전체 로그 수집
  const allLogs = [];
  for (const date of dates) {
    const logs = await getLogsForDate(env.STUDYCAST_DATA, date);
    allLogs.push(...logs);
  }

  // 집계: byLecture
  const lectureMap = {}; // repo → { visits, users: Set }
  const userMap = {};    // email → { visits, lastTs }
  const dailyMap = {};   // date → count

  // 빈 날짜도 0으로 초기화
  dates.forEach(d => { dailyMap[d] = 0; });

  const adminEmail = (env.ADMIN_EMAIL || '').toLowerCase();
  allLogs.forEach(log => {
    const { email, repo, ts } = log;
    if (email === adminEmail) return;
    const dateStr = new Date(ts).toISOString().slice(0, 10);

    // daily
    if (dailyMap[dateStr] !== undefined) dailyMap[dateStr]++;

    // byUser
    if (!userMap[email]) userMap[email] = { visits: 0, lastTs: 0 };
    userMap[email].visits++;
    if (ts > userMap[email].lastTs) userMap[email].lastTs = ts;

    // byLecture (허브 제외)
    if (repo !== '_hub') {
      if (!lectureMap[repo]) lectureMap[repo] = { visits: 0, users: new Set() };
      lectureMap[repo].visits++;
      lectureMap[repo].users.add(email);
    }
  });

  // 응답 구성
  const byLecture = Object.entries(lectureMap)
    .map(([repo, d]) => ({
      repo,
      title: titleMap[repo] || repo,
      visits: d.visits,
      uniqueUsers: d.users.size,
    }))
    .sort((a, b) => b.visits - a.visits);

  const byUser = Object.entries(userMap)
    .map(([email, d]) => ({
      email,
      visits: d.visits,
      lastVisit: new Date(d.lastTs).toISOString(),
    }))
    .sort((a, b) => b.visits - a.visits);

  const daily = dates.map(d => ({ date: d, visits: dailyMap[d] }));

  return json({ period, range: [rangeStart, rangeEnd], byLecture, byUser, daily });
}
