import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'STAMP — AI Provenance on Monad',
  description:
    'A creator platform where every AI-generated file carries a verifiable, tamper-proof origin stored on Monad and indexed by Envio.',
  openGraph: {
    title: 'STAMP',
    description: 'Invisible watermarks. On-chain provenance. Verify AI content anywhere.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased min-h-screen bg-[#f6f7f8] text-[#0f0f0f]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
