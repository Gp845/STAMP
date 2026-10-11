'use client';

import JoinButton from './JoinButton';
import { LockIcon } from './icons';
import { remaining, useNow, useSubs } from '@/lib/subs';

export default function MemberGate({
  handle,
  monthly,
  locked,
  children,
}: {
  handle: string;
  monthly: number;
  locked: boolean;
  children: React.ReactNode;
}) {
  const sub = useSubs()[handle];
  const now = useNow(locked);
  const open = !locked || (!!sub && remaining(sub, now) > 0);

  if (open) return children;

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 rounded-xl bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-3 px-4 text-center">
        <LockIcon className="w-10 h-10" />
        <p className="font-medium">Members only</p>
        <p className="text-sm text-[#ddd]">Billed every second. Stop anytime and the rest comes back.</p>
        <JoinButton handle={handle} monthly={monthly} />
      </div>
    </div>
  );
}
