// 로그 제외 패턴: API, 정적 리소스
const SKIP_PREFIXES = ['/api/'];
const SKIP_EXTENSIONS = ['.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.map'];

function shouldLog(pathname) {
  if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) return false;
  if (SKIP_EXTENSIONS.some(ext => pathname.endsWith(ext))) return false;
  return true;
}

function extractRepo(pathname) {
  // 허브 자체는 로깅 제외 (유의미한 지표 아님)
  if (pathname === '/' || pathname === '/index.html') return null;
  // "/{repo}/" 또는 "/{repo}/index.html" → SC 뷰어
  const match = pathname.match(/^\/([a-z0-9-]+)\/?(?:index\.html)?$/);
  return match ? match[1] : null;
}

async function logVisit(context, email, repo) {
  const now = Date.now();
  const rand = Math.random().toString(16).slice(2, 6);
  const dateStr = new Date(now).toISOString().slice(0, 10);
  const key = `log:${dateStr}:${now}-${rand}`;
  const value = JSON.stringify({
    email,
    path: new URL(context.request.url).pathname,
    repo,
    ts: now,
  });
  await context.env.STUDYCAST_DATA.put(key, value);
}

export async function onRequest(context) {
  // 1. 원래 응답 먼저 확보 — 로깅 실패해도 서비스 정상
  const response = await context.next();

  try {
    const url = new URL(context.request.url);
    const email = context.request.headers.get('Cf-Access-Authenticated-User-Email');

    if (email && shouldLog(url.pathname)) {
      const repo = extractRepo(url.pathname);
      if (repo) {
        context.waitUntil(logVisit(context, email.toLowerCase(), repo));
      }
    }
  } catch (e) {
    // 무시 — 로깅 실패가 서비스에 영향 주면 안 됨
  }

  return response;
}
