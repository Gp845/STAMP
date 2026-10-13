'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Earnings from './Earnings';
import { connectWallet, currentAccount } from '@/lib/wallet';

export default function ChannelDesk({
  address,
  monthly,
  canPrice,
}: {
  address: string;
  monthly: string;
  canPrice: boolean;
}) {
  const router = useRouter();
  const [owner, setOwner] = useState(false);
  const [price, setPrice] = useState(monthly);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentAccount().then((account) => {
      setOwner(!!account && account.toLowerCase() === address.toLowerCase());
    });
  }, [address]);

  if (!owner) {
    if (!canPrice) return null;
    return (
      <div>
        <button
          onClick={async () => {
            setError(null);
            try {
              const who = await connectWallet();
              const mine = who.toLowerCase() === address.toLowerCase();
              setOwner(mine);
              if (!mine) setError('This wallet is not this page.');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not connect');
            }
          }}
          className="mt-4 h-8 px-3 rounded-full bg-[#f2f2f2] text-sm font-medium"
        >
          Connect to set your price
        </button>
        {error && <p className="mt-2 text-sm text-amber-800">{error}</p>}
      </div>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const who = await connectWallet();
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator: who, monthly: price }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save this price');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this price');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      {canPrice && (
      <section className="mb-8 rounded-xl border border-black/10 bg-white p-5 max-w-xl">
        <h2 className="font-semibold">Membership price</h2>
        <p className="mt-1 text-sm text-[#606060]">
          MON per month. Fans are billed every second and can stop whenever they want.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            className="h-9 w-32 rounded-lg border border-black/10 px-3 text-sm"
          />
          <button
            disabled={busy}
            onClick={save}
            className="h-9 px-4 rounded-full bg-[#0f0f0f] text-white text-sm font-medium disabled:opacity-40"
          >
            Save price
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-amber-800">{error}</p>}
      </section>
      )}
      <Earnings fixedAccount={address} />
    </div>
  );
}
