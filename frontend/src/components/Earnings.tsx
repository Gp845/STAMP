'use client';

import { useCallback, useEffect, useState } from 'react';
import { earnedWei, syncMemberships, useNow } from '@/lib/subs';
import {
  collectFrom,
  connectWallet,
  currentAccount,
  formatWei,
  loadIncoming,
  type IncomingMember,
} from '@/lib/wallet';

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Earnings({ fixedAccount }: { fixedAccount?: string }) {
  const [account, setAccount] = useState<string | null>(fixedAccount ?? null);
  const [members, setMembers] = useState<IncomingMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const now = useNow(members.length > 0);

  const refresh = useCallback(async (who: string) => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await loadIncoming(who));
      await syncMemberships(who);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fixedAccount) {
      setAccount(fixedAccount);
      refresh(fixedAccount);
      return;
    }
    currentAccount().then((who) => {
      if (!who) return;
      setAccount(who);
      refresh(who);
    });
  }, [fixedAccount, refresh]);

  async function connect() {
    setError(null);
    try {
      const who = await connectWallet();
      setAccount(who);
      await refresh(who);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect');
    }
  }

  async function collect(fan: string) {
    setBusy(fan);
    setError(null);
    setNote(null);
    try {
      await collectFrom(fan);
      setNote(`Collected from ${shortAddr(fan)}.`);
      if (account) await refresh(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not collect');
    } finally {
      setBusy(null);
    }
  }

  const nowSec = Math.floor(now / 1000);

  return (
    <section className="mb-8 rounded-xl border border-black/10 bg-white p-5">
      <h2 className="font-semibold">Members</h2>
      <p className="mt-1 text-sm text-[#606060]">
        Collect what has been billed so far. The rest of their balance stays put until you collect again or they stop.
      </p>
      {!account ? (
        <button onClick={connect} className="mt-4 h-8 px-3 rounded-full bg-[#0f0f0f] text-white text-sm font-medium">
          Connect to see members
        </button>
      ) : loading ? (
        <p className="mt-4 text-sm text-[#606060]">Looking up members…</p>
      ) : members.length === 0 ? (
        <p className="mt-4 text-sm text-[#606060]">No one is paying you yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-black/10">
          {members.map((member) => {
            const earned = earnedWei(BigInt(member.depositWei), BigInt(member.rateWei), member.start, nowSec);
            const left = BigInt(member.depositWei) - earned;
            return (
              <li key={member.fan} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{shortAddr(member.fan)}</p>
                  <p className="text-[#606060]">
                    {formatWei(earned)} MON billed · {formatWei(left)} MON still deposited
                  </p>
                </div>
                <button
                  disabled={busy !== null || earned === BigInt(0)}
                  onClick={() => collect(member.fan)}
                  className="h-8 px-3 rounded-full bg-[#0f0f0f] text-white text-sm font-medium disabled:opacity-40"
                >
                  {busy === member.fan ? 'Collecting…' : 'Collect'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {note && <p className="mt-3 text-sm text-[#606060]">{note}</p>}
      {error && <p className="mt-3 text-sm text-amber-800">{error}</p>}
    </section>
  );
}
