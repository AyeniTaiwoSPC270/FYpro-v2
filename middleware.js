// Vercel Routing Middleware — framework-agnostic, runs before every request.
// Redirects to /maintenance when maintenance mode is active.
// Uses Upstash REST API directly (no SDK) so it runs on the Edge Runtime.

const REDIS_KEY = 'app:maintenance_mode';
const CACHE_TTL = 30;

async function isMaintenanceActive() {
  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return false;

  try {
    const rRes  = await fetch(`${redisUrl}/get/${encodeURIComponent(REDIS_KEY)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    const rJson = await rRes.json();

    if (rJson.result !== null && rJson.result !== undefined) {
      return rJson.result === 'true';
    }

    // Cache miss — check Supabase directly via REST
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) return false;

    const sbRes = await fetch(
      `${sbUrl}/rest/v1/app_config?key=eq.maintenance_mode&select=value&limit=1`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    );
    const rows   = await sbRes.json();
    const active = Array.isArray(rows) && rows[0]?.value === 'true';

    // Seed Redis so the next request is a cache hit
    fetch(`${redisUrl}/set/${encodeURIComponent(REDIS_KEY)}/${active}?ex=${CACHE_TTL}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${redisToken}` },
    }).catch(() => {});

    return active;
  } catch {
    return false; // fail-open — never block requests on Redis/Supabase error
  }
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  // Always pass through: maintenance page, admin routes, all API calls, static assets
  if (
    pathname === '/maintenance' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/assets/') ||
    /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff2?|ttf|otf|map|txt|xml)$/i.test(pathname)
  ) {
    return;
  }

  const active = await isMaintenanceActive();
  if (!active) return;

  return Response.redirect(new URL('/maintenance', request.url), 302);
}
