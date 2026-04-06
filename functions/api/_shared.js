// JSON 응답 헬퍼
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// 관리자 확인
export function isAdmin(request, env) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email") || "";
  return email.toLowerCase() === (env.ADMIN_EMAIL || "").toLowerCase();
}

// 쓰기 권한 확인 (관리자가 아니면 403 반환)
export function requireAdmin(request, env) {
  if (!isAdmin(request, env)) {
    return json({ error: "forbidden" }, 403);
  }
  return null;
}
