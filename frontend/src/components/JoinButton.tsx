'use client';

import { useState } from 'react';
import {
  accrued,
  cancelSub,
  elapsedSeconds,
  MONTH_SECONDS,
  perSecond,
  remaining,
  startSub,
  useNow,
  useSubs,
} from '@/lib/subs';

const CHOICES = [
  { label: '1 minute', seconds: 60 },
  { label: '30 days', seconds: MONTH_SECONDS },
];

export function formatMon(n: number) {
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(8);
}

export default function JoinButton({
  handle,
  monthly,
  large = false,
}: {
  handle: string;
  monthly: number;
  large?: boolean;
}) {
  const subs = useSubs();
  const sub = subs[handle];
  const now = useNow(!!sub);
  const [open, setOpen] = useState(false);
  const [refund, setRefund] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const alive = !!sub && remaining(sub, now) > 0;
  const spent = sub ? accrued(sub, now) : 0;
  const left = sub ? remaining(sub, now) : 0;

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        onClick={() => {
          setRefund(null);
          setOpen((v) => !v);
        }}
        className={`rounded-full font-medium text-sm transition-colors ${large ? 'h-10 px-5' : 'h-9 px-4'} ${
          alive ? 'bg-[#f2f2f2] hover:bg-[#e5e5e5]' : 'bg-[#0f0f0f] hover:bg-[#272727] text-white'
        }`}
      >
        {alive ? 'Member' : `Join · ${monthly} MON/mo`}
      </button>

      {open && (
        <div className="w-72 rounded-xl bg-white border border-black/10 shadow-lg p-3 text-sm">
          <p>
            {monthly} MON/month, billed at {formatMon(perSecond(monthly))} MON every second. Stop whenever you want and
            the unused amount comes back.
          </p>

          {alive && sub ? (
            <>
              <div className="mt-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full bg-[#836EF9]" style={{ width: `${(left / sub.deposit) * 100}%` }} />
              </div>
              <p className="mt-2 text-[#606060]">
                {elapsedSeconds(sub, now)}s billed · {formatMon(spent)} MON · {formatMon(left)} left
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    setRefund(await cancelSub(handle));
                    setOpen(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not stop');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mt-3 h-8 px-3 rounded-full bg-[#0f0f0f] text-white text-sm font-medium disabled:opacity-40"
              >
                Stop and get the rest back
              </button>
            </>
          ) : (
            <div className="mt-3 flex gap-2">
              {CHOICES.map((c) => (
                <button
                  key={c.label}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await startSub(handle, monthly, c.seconds);
                      setRefund(null);
                      setOpen(true);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not join');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="h-8 px-3 rounded-full bg-[#0f0f0f] text-white text-sm font-medium disabled:opacity-40"
                >
                  Add {c.label}
                </button>
              ))}
            </div>
          )}

          {refund !== null && <p className="mt-2 text-[#606060]">{formatMon(refund)} MON came back.</p>}
          {error && <p className="mt-2 text-amber-800">{error}</p>}
        </div>
      )}
    </div>
  );
}
