'use client';

import { useEffect, useState } from 'react';
import { CREATORS } from './feed';
import { SUBS_READY, cancelOnChain, currentAccount, loadFanSubs, loadMembership, subscribeOnChain } from './wallet';

// 30-day month, same idea as StreamSub: owed = seconds * rate, capped at the deposit.
export const MONTH_SECONDS = 30 * 24 * 60 * 60;

export interface Sub {
  handle: string;
  ratePerSec: number;
  deposit: number;
  startedAt: number;
  onChain?: boolean;
}

// The meter stays in localStorage so the page can tick every second. The deposit itself is StreamSub when that address is set.
const KEY = 'stamp-subs';
const WEI = BigInt(10) ** BigInt(18);
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

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function creatorAddress(handle: string) {
  const address = CREATORS.find((creator) => creator.handle === handle)?.address;
  if (address) return address;
  if (ADDRESS.test(handle)) return handle;
  throw new Error('This creator has no wallet address.');
}

function handleFor(address: string) {
  const known = CREATORS.find((creator) => creator.address.toLowerCase() === address.toLowerCase());
  return known?.handle ?? address.toLowerCase();
}

function weiToMon(wei: string) {
  const value = BigInt(wei);
  return Number(value / WEI) + Number(value % WEI) / 1e18;
}

export function earnedWei(depositWei: bigint, rateWei: bigint, start: number, nowSec: number) {
  if (nowSec <= start || rateWei <= BigInt(0)) return BigInt(0);
  const owed = BigInt(nowSec - start) * rateWei;
  return owed > depositWei ? depositWei : owed;
}

export async function syncMemberships(account: string) {
  if (!SUBS_READY) return;
  const rows = await loadFanSubs(account);
  const next = read();
  const seen = new Set<string>();
  for (const row of rows) {
    const handle = handleFor(row.creator);
    seen.add(handle);
    next[handle] = {
      handle,
      ratePerSec: weiToMon(row.rateWei),
      deposit: weiToMon(row.depositWei),
      startedAt: row.start * 1000,
      onChain: true,
    };
  }
  for (const handle of Object.keys(next)) {
    if (next[handle].onChain && !seen.has(handle)) delete next[handle];
  }
  write(next);
}

function monToWei(mon: number) {
  return (BigInt(Math.round(mon * 1_000_000)) * WEI) / BigInt(1_000_000);
}

export async function startSub(handle: string, monthly: number, seconds: number) {
  const ratePerSec = perSecond(monthly);
  if (SUBS_READY) {
    const rateWei = monToWei(monthly) / BigInt(MONTH_SECONDS);
    if (rateWei < BigInt(1)) throw new Error('That price is too small to bill on chain.');
    await subscribeOnChain(creatorAddress(handle), rateWei, rateWei * BigInt(seconds));
  }
  const next = read();
  next[handle] = { handle, ratePerSec, deposit: ratePerSec * seconds, startedAt: Date.now(), onChain: SUBS_READY };
  write(next);
  const account = await currentAccount();
  if (account) await syncMemberships(account).catch(() => {});
}

export async function syncOne(handle: string) {
  const account = await currentAccount();
  if (!account || !SUBS_READY) return;
  const row = await loadMembership(account, creatorAddress(handle));
  const next = read();
  if (!row) {
    if (next[handle]?.onChain) {
      delete next[handle];
      write(next);
    }
    return;
  }
  next[handle] = {
    handle,
    ratePerSec: weiToMon(row.rateWei),
    deposit: weiToMon(row.depositWei),
    startedAt: row.start * 1000,
    onChain: true,
  };
  write(next);
}

export async function cancelSub(handle: string, now = Date.now()) {
  const existing = read()[handle];
  if (!existing) return 0;
  if (existing.onChain) {
    await syncOne(handle);
    if (!read()[handle]) return 0;
    await cancelOnChain(creatorAddress(handle));
  }
  const sub = read()[handle];
  const refund = sub ? remaining(sub, now) : 0;
  const next = read();
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
  const ten = WEI * BigInt(10);
  if (earnedWei(ten, WEI, 0, 4) !== WEI * BigInt(4)) throw new Error('earned');
  if (earnedWei(ten, WEI, 0, 100) !== ten) throw new Error('earned cap');
}
selfCheck();
