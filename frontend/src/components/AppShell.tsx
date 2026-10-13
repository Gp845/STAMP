'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CREATORS } from '@/lib/feed';
import { remaining, useNow, useSubs } from '@/lib/subs';
import Avatar from './Avatar';
import { BotIcon, HomeIcon, MenuIcon, PlusIcon, SearchIcon, ShieldIcon, StudioIcon } from './icons';

const NAV = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/verify', label: 'Verify', Icon: ShieldIcon },
  { href: '/agents', label: 'Agents', Icon: BotIcon },
  { href: '/dashboard', label: 'Your studio', Icon: StudioIcon },
];

function TopBar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-black/10 flex items-center justify-between gap-4 px-4">
      <div className="flex items-center gap-4 shrink-0">
        <button onClick={onMenu} className="p-2 rounded-full hover:bg-black/5" aria-label="Toggle sidebar">
          <MenuIcon />
        </button>
        <Link href="/" className="flex items-center gap-1.5">
          <div className="w-7 h-5 rounded-md bg-[#836EF9] flex items-center justify-center text-[11px] font-black text-white">
            S
          </div>
          <span className="font-semibold tracking-tight text-lg">STAMP</span>
        </Link>
      </div>

      <form
        className="hidden sm:flex flex-1 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search creators, posts, models"
          className="flex-1 h-10 px-4 rounded-l-full bg-white border border-black/15 text-[15px] placeholder-[#606060] focus:outline-none focus:border-[#0f0f0f]"
        />
        <button
          type="submit"
          className="h-10 w-16 rounded-r-full bg-white border border-l-0 border-black/15 flex items-center justify-center hover:bg-[#f6f7f8]"
          aria-label="Search"
        >
          <SearchIcon className="w-5 h-5" />
        </button>
      </form>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/verify"
          className="hidden md:flex items-center gap-1.5 h-9 px-3 rounded-full hover:bg-black/5 text-sm font-medium"
        >
          <ShieldIcon className="w-5 h-5" /> Verify
        </Link>
        <Link
          href="/upload"
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#f2f2f2] hover:bg-[#e5e5e5] text-sm font-medium"
        >
          <PlusIcon className="w-5 h-5" /> Create
        </Link>
      </div>
    </header>
  );
}

function Sidebar({ mini, onNavigate }: { mini: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const subs = useSubs();
  const now = useNow(Object.keys(subs).length > 0);

  if (mini) {
    return (
      <nav className="flex flex-col items-center gap-1 py-1">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`w-16 flex flex-col items-center gap-1 py-4 rounded-lg text-[10px] hover:bg-black/5 ${
              pathname === href ? 'bg-[#f2f2f2] font-medium' : ''
            }`}
          >
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col px-3 py-2 text-sm">
      {NAV.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={`flex items-center gap-6 h-10 px-3 rounded-lg ${
            pathname === href ? 'bg-[#f2f2f2] font-medium' : 'hover:bg-black/5'
          }`}
        >
          <Icon />
          {label}
        </Link>
      ))}

      <hr className="my-3 border-black/10" />
      <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-[#606060]">Subscriptions</p>
      {CREATORS.map((c) => (
        <Link
          key={c.handle}
          href={`/c/${c.handle}`}
          onClick={onNavigate}
          className={`flex items-center gap-4 h-10 px-3 rounded-lg ${
            pathname === `/c/${c.handle}` ? 'bg-[#f2f2f2]' : 'hover:bg-black/5'
          }`}
        >
          <Avatar creator={c} size={24} />
          <span className="truncate flex-1">{c.name}</span>
          {subs[c.handle] && remaining(subs[c.handle], now) > 0 && (
            <span className="text-[10px] text-[#606060]">member</span>
          )}
        </Link>
      ))}

      <hr className="my-3 border-black/10" />
      <p className="px-3 text-xs text-[#606060] leading-relaxed">
        Every post carries an invisible watermark and a fingerprint anchored on Monad, indexed by Envio.
      </p>
      <p className="px-3 mt-3 text-xs text-[#909090]">
        Built for{' '}
        <a
          href="https://monad.xyz/developers/hackathons/metropolis"
          target="_blank"
          rel="noreferrer"
          className="hover:text-black"
        >
          Monad Metropolis
        </a>
      </p>
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <TopBar
        onMenu={() => {
          if (window.matchMedia('(min-width: 1024px)').matches) setExpanded((v) => !v);
          else setDrawerOpen((v) => !v);
        }}
      />

      <aside
        className={`hidden lg:block fixed top-14 bottom-0 left-0 overflow-y-auto bg-white border-r border-black/10 ${
          expanded ? 'w-60' : 'w-[72px]'
        }`}
      >
        <Sidebar mini={!expanded} />
      </aside>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute top-14 bottom-0 left-0 w-60 overflow-y-auto bg-white border-r border-black/10">
            <Sidebar mini={false} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className={`pt-14 min-h-screen ${expanded ? 'lg:pl-60' : 'lg:pl-[72px]'}`}>{children}</main>
    </>
  );
}
