'use client';

import Link from 'next/link';
import { CREATORS } from '@/lib/feed';
import { accrued, cancelSub, elapsedSeconds, remaining, useNow, useSubs } from '@/lib/subs';
import { formatMon } from './JoinButton';

export default function Memberships() {
  const subs = useSubs();
  const list = Object.values(subs);
  const now = useNow(list.length > 0);

  return (
    <section className="mb-8 rounded-2xl border border-black/10 bg-[#f7f7f7] p-5">
      <h2 className="font-semibold">Memberships</h2>
      <p className="mt-1 text-sm text-[#606060]">Billed every second. Stopping returns whatever is left.</p>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-[#606060]">None yet. Join a creator from their page.</p>
      ) : (
        <ul className="mt-4 divide-y divide-black/10">
          {list.map((sub) => {
            const creator = CREATORS.find((c) => c.handle === sub.handle);
            const left = remaining(sub, now);
            return (
              <li key={sub.handle} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link href={`/c/${sub.handle}`} className="font-medium hover:underline">
                    {creator?.name ?? sub.handle}
                  </Link>
                  <p className="text-[#606060]">
                    {left > 0
                      ? `${elapsedSeconds(sub, now)}s billed · ${formatMon(accrued(sub, now))} MON · ${formatMon(left)} left`
                      : 'Ended. The balance ran out.'}
                  </p>
                </div>
                {left > 0 && (
                  <button
                    onClick={() => cancelSub(sub.handle)}
                    className="h-8 px-3 rounded-full bg-[#0f0f0f] text-white text-sm font-medium"
                  >
                    Stop
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
