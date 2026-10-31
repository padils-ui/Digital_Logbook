'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  BookOpenText,
  Building2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCog,
  Users,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  super_admin: [
    { href: '/dashboard', label: 'Papan Pemuka', icon: LayoutDashboard },
    { href: '/admin/tenants', label: 'Pengurusan Pusat', icon: Building2 },
    { href: '/admin/students', label: 'Pengurusan Anak', icon: Users },
    { href: '/admin/classes', label: 'Pengurusan Kelas', icon: GraduationCap },
    { href: '/teacher', label: 'Ruang Pendidik', icon: BookOpenText },
    { href: '/teacher/kehadiran', label: 'Kehadiran Anak', icon: ClipboardCheck },
    { href: '/teacher/pentaksiran', label: 'Laporan Pentaksiran', icon: FileText },
    { href: '/profile-cards', label: 'Kad Profil Anak', icon: IdCard },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
  admin_papn: [
    { href: '/dashboard', label: 'Papan Pemuka', icon: LayoutDashboard },
    { href: '/admin/students', label: 'Pengurusan Anak', icon: Users },
    { href: '/admin/classes', label: 'Pengurusan Kelas', icon: GraduationCap },
    { href: '/teacher', label: 'Ruang Pendidik', icon: BookOpenText },
    { href: '/teacher/kehadiran', label: 'Kehadiran Anak', icon: ClipboardCheck },
    { href: '/teacher/pentaksiran', label: 'Laporan Pentaksiran', icon: FileText },
    { href: '/profile-cards', label: 'Kad Profil Anak', icon: IdCard },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
  teacher: [
    { href: '/teacher', label: 'Ruang Pendidik', icon: BookOpenText },
    { href: '/teacher/kehadiran', label: 'Kehadiran Anak', icon: ClipboardCheck },
    { href: '/teacher/pentaksiran', label: 'Laporan Pentaksiran', icon: FileText },
    { href: '/profile-cards', label: 'Kad Profil Anak', icon: IdCard },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
  parent: [
    { href: '/parent', label: 'Ruang Ibu Bapa', icon: Users },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
};

/**
 * Seksyen khas "PENTADBIRAN PAPN" — hanya dipaparkan kepada super_admin dan
 * admin_papn. Item navigasi sedia ada tidak diubah.
 */
const ADMIN_SECTION_ITEMS: NavItem[] = [
  { href: '/admin/pendidik', label: 'Pengurusan Pendidik', icon: UserCog },
  { href: '/admin/ibu-bapa', label: 'Pengurusan Ibu Bapa', icon: UsersRound },
  { href: '/admin/pemantauan', label: 'Pemantauan Log & AI', icon: Activity },
  { href: '/admin/tetapan', label: 'Tetapan PAPN', icon: Settings },
];

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin_papn: 'Pentadbir PAPN',
  teacher: 'Pendidik / Pengasuh',
  parent: 'Ibu Bapa / Penjaga',
};

export function AppShell({
  role,
  fullName,
  tenantName,
  logoUrl,
  children,
}: {
  role: UserRole;
  fullName: string;
  tenantName: string;
  /** URL awam logo pusat; null bermakna guna penjenamaan lalai. */
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV_BY_ROLE[role];
  const adminItems =
    role === 'super_admin' || role === 'admin_papn' ? ADMIN_SECTION_ITEMS : [];

  /** Tajuk laluan aktif (padanan paling spesifik) untuk pengepala mudah alih. */
  const activeTitle = [...items, ...adminItems]
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.label;

  // Tutup laci mudah alih apabila pengguna menekan kekunci Escape.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Buang cookie peranan supaya sesi seterusnya bermula bersih.
    document.cookie = 'papn_role=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/login';
  }

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const active =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        {item.label}
      </Link>
    );
  }

  const nav = (
    <nav aria-label="Navigasi utama">
      <div className="flex flex-col gap-1">{items.map(renderItem)}</div>

      {adminItems.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pentadbiran PAPN
          </p>
          <div className="flex flex-col gap-1">{adminItems.map(renderItem)}</div>
        </div>
      ) : null}
    </nav>
  );

  /** Pengepala kecil nama pusat di bar sisi (dengan logo jika ada). */
  const tenantHeading = (
    <div className="mb-3 flex items-center gap-2 px-3">
      {logoUrl ? (
        <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-white">
          <Image
            src={logoUrl}
            alt={`Logo ${tenantName}`}
            fill
            sizes="24px"
            className="object-contain"
          />
        </span>
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {tenantName}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Bar atas */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost -ml-2 min-h-touch px-2 md:hidden"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
          {logoUrl ? (
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white">
                <Image
                  src={logoUrl}
                  alt={`Logo ${tenantName}`}
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </span>
              <span className="hidden text-sm font-bold text-slate-900 sm:inline sm:text-base">
                {tenantName}
              </span>
            </Link>
          ) : (
            <span className="shrink-0 text-sm font-bold text-slate-900 sm:text-base">
              PERMATALog
            </span>
          )}
          {activeTitle ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="hidden h-4 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
              <span className="truncate text-sm font-medium text-slate-600">
                {activeTitle}
              </span>
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-800">
              {fullName}
            </p>
            <p className="text-xs leading-tight text-slate-500">
              {ROLE_LABEL[role]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="btn-ghost min-h-touch px-2"
            aria-label="Log keluar"
          >
            <LogOut className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        {/* Sidebar desktop */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
          {tenantHeading}
          {nav}
        </aside>

        {/* Drawer mudah alih */}
        {open ? (
          <div className="fixed inset-0 z-20 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <aside
              id="mobile-nav-drawer"
              aria-label="Navigasi mudah alih"
              className="absolute left-0 top-14 h-[calc(100vh-3.5rem)] w-64 max-w-[85vw] overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-xl"
            >
              {tenantHeading}
              {nav}
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
