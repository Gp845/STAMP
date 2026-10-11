import { Suspense } from 'react';
import Feed from '@/components/Feed';

export default function HomePage() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}
