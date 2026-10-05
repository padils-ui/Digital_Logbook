'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BookOpenText,
  Building2,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  UserRound,
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
    { href: '/admin/students', label: 'Pengurusan Murid', icon: Users },
    { href: '/admin/classes', label: 'Pengurusan Kelas', icon: GraduationCap },
    { href: '/teacher', label: 'Ruang Guru', icon: BookOpenText },
    { href: '/profile-cards', label: 'Kad Profil Anak', icon: IdCard },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
  admin_papn: [
    { href: '/dashboard', label: 'Papan Pemuka', icon: LayoutDashboard },
    { href: '/admin/students', label: 'Pengurusan Murid', icon: Users },
    { href: '/admin/classes', label: 'Pengurusan Kelas', icon: GraduationCap },
    { href: '/teacher', label: 'Ruang Guru', icon: BookOpenText },
    { href: '/profile-cards', label: 'Kad Profil Anak', icon: IdCard },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
  teacher: [
    { href: '/teacher', label: 'Ruang Guru', icon: BookOpenText },
    { href: '/profile-cards', label: 'Kad Profil Anak', icon: IdCard },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
  parent: [
    { href: '/parent', label: 'Ruang Ibu Bapa', icon: Users },
    { href: '/profile', label: 'Kad Profil', icon: UserRound },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin_papn: 'Pentadbir PAPN',
  teacher: 'Guru / Pengasuh',
  parent: 'Ibu Bapa / Penjaga',
};

export function AppShell({
  role,
  fullName,
  tenantName,
  children,
}: {
  role: UserRole;
  fullName: string;
  tenantName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV_BY_ROLE[role];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Buang cookie peranan supaya sesi seterusnya bermula bersih.
    document.cookie = 'papn_role=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/login';
  }

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
      {items.map((item) => {
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
              active
                ? 'bg-brand-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Bar atas */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost -ml-2 px-2 lg:hidden"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
          <span className="text-sm font-bold text-slate-900 sm:text-base">
            Digital Logbook PAPN
          </span>
        </div>
        <div className="flex items-center gap-3">
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
            className="btn-ghost px-2"
            aria-label="Log keluar"
          >
            <LogOut className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        {/* Sidebar desktop */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {tenantName}
          </p>
          {nav}
        </aside>

        {/* Drawer mudah alih */}
        {open ? (
          <div className="fixed inset-0 z-20 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <aside className="absolute left-0 top-14 h-[calc(100vh-3.5rem)] w-64 border-r border-slate-200 bg-white p-4">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {tenantName}
              </p>
              {nav}
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
