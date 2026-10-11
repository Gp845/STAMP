'use client';

import { useEffect, useState } from 'react';

// 30-day month, same idea as StreamSub: owed = seconds * rate, capped at the deposit.
export const MONTH_SECONDS = 30 * 24 * 60 * 60;

export interface Sub {
  handle: string;
  ratePerSec: number;
  deposit: number;
  startedAt: number;
}

// shortcut: memberships live in localStorage, not in StreamSub. Upgrade when the contract is deployed and the app has a wallet.
const KEY = 'stamp-subs';
const listeners = new Set<() => void>();

function read(): Record<string, Sub> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(next: Record<string, Sub>) {
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function perSecond(monthly: number) {
  return monthly / MONTH_SECONDS;
}

export function accrued(sub: Sub, now = Date.now()) {
  const owed = ((now - sub.startedAt) / 1000) * sub.ratePerSec;
  return Math.min(sub.deposit, Math.max(0, owed));
}

export function remaining(sub: Sub, now = Date.now()) {
  return sub.deposit - accrued(sub, now);
}

export function startSub(handle: string, monthly: number, seconds: number) {
  const ratePerSec = perSecond(monthly);
  const next = read();
  next[handle] = { handle, ratePerSec, deposit: ratePerSec * seconds, startedAt: Date.now() };
  write(next);
}

export function cancelSub(handle: string, now = Date.now()) {
  const next = read();
  const sub = next[handle];
  if (!sub) return 0;
  const refund = remaining(sub, now);
  delete next[handle];
  write(next);
  return refund;
}

// First render matches the server (no membership yet); localStorage is read after mount.
export function useSubs() {
  const [subs, setSubs] = useState<Record<string, Sub>>({});
  useEffect(() => {
    setSubs(read());
    const update = () => setSubs(read());
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return subs;
}

export function elapsedSeconds(sub: Sub, now: number) {
  if (now <= 0) return 0;
  return Math.max(0, Math.floor((now - sub.startedAt) / 1000));
}

export function useNow(on: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

function selfCheck() {
  const sub: Sub = { handle: 'x', ratePerSec: 2 / MONTH_SECONDS, deposit: 2, startedAt: 0 };
  if (Math.abs(accrued(sub, MONTH_SECONDS * 1000) - 2) > 1e-9) throw new Error('accrual cap');
  if (Math.abs(accrued(sub, (MONTH_SECONDS / 2) * 1000) - 1) > 1e-9) throw new Error('accrual half');
}
selfCheck();
