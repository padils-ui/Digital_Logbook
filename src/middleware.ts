import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/** Peranan yang sah dalam sistem. */
type Role = 'super_admin' | 'admin_papn' | 'teacher' | 'parent';

/**
 * Laluan awam — middleware TIDAK akan mengubah hala atau menyekat
 * laluan-laluan ini tanpa mengira status sesi.
 */
const PUBLIC_PATHS = ['/login', '/auth/callback', '/offline', '/api/auth'];

/** Laluan lalai mengikut peranan selepas log masuk. */
const ROLE_HOME: Record<Role, string> = {
  super_admin: '/dashboard',
  admin_papn: '/dashboard',
  teacher: '/teacher',
  parent: '/parent',
};

/** Peranan yang dibenarkan mengakses setiap awalan laluan. */
const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: '/dashboard', roles: ['super_admin', 'admin_papn'] },
  { prefix: '/teacher', roles: ['teacher', 'admin_papn', 'super_admin'] },
  { prefix: '/parent', roles: ['parent'] },
  { prefix: '/profile-cards', roles: ['super_admin', 'admin_papn', 'teacher'] },
];

/** Nama cookie yang menyimpan peranan pengguna (ditetapkan semasa log masuk). */
export const ROLE_COOKIE = 'papn_role';

function isRole(value: string | undefined): value is Role {
  return (
    value === 'super_admin' ||
    value === 'admin_papn' ||
    value === 'teacher' ||
    value === 'parent'
  );
}

/**
 * Middleware berjalan pada Edge runtime.
 *
 * Susunan semakan:
 *
 * 1. Laluan awam (/login, /api/auth, dll) — benarkan sentiasa.
 *
 * 2. Semak cookie papn_role DAHULU. Cookie ini ditetapkan oleh server
 *    selepas pengesahan berjaya. Jika ada dan sah, benarkan akses terus
 *    tanpa perlu menunggu getUser() — ini mengelakkan isu sesi lambat
 *    selepas window.location.href redirect.
 *
 * 3. Jika tiada cookie papn_role, semak sesi Supabase. Jika tiada sesi,
 *    ubah hala ke /login sekali sahaja.
 *
 * 4. Jika ada sesi tetapi tiada cookie papn_role, ubah hala ke /login
 *    supaya pengguna log masuk semula (loginAction akan tetapkan cookie).
 *
 * 5. Semak peranan vs laluan yang diminta.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Peraturan 1: Laluan awam — benarkan sentiasa.
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // Baca cookie papn_role dari request.
  const cookieRole = request.cookies.get(ROLE_COOKIE)?.value;
  const role = isRole(cookieRole) ? cookieRole : null;

  console.log('[Middleware]', pathname, 'papn_role:', cookieRole ?? '(tiada)');

  // Peraturan 2: Cookie papn_role sah — benarkan akses terus.
  // Ini mengelakkan isu di mana sb-* session cookies belum dihantar
  // pada permintaan pertama selepas window.location.href redirect.
  if (role) {
    const rule = ROUTE_ROLES.find(
      (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
    );
    if (rule && !rule.roles.includes(role)) {
      // Peranan tidak dibenarkan untuk laluan ini — ubah hala ke rumah peranan.
      const url = request.nextUrl.clone();
      url.pathname = ROLE_HOME[role];
      url.search = '';
      console.log('[Middleware] peranan', role, 'tidak dibenarkan untuk', pathname, '→', url.pathname);
      return NextResponse.redirect(url);
    }
    // Peranan dibenarkan — teruskan dengan menyegarkan sesi.
    const { response } = await updateSession(request);
    return response;
  }

  // Peraturan 3 & 4: Tiada cookie papn_role — semak sesi Supabase.
  const { user } = await updateSession(request);

  if (!user) {
    // Tiada sesi langsung.
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirectTo', pathname);
    console.log('[Middleware] tiada sesi, ubah hala ke /login');
    return NextResponse.redirect(url);
  }

  // Ada sesi tetapi tiada cookie papn_role — minta log masuk semula.
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  console.log('[Middleware] sesi ada tapi tiada cookie papn_role, ubah hala ke /login');
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
