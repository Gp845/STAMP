// Demo feed data until creator profiles and posts are read from Envio.

export type Origin = 'agent' | 'human' | 'external';

export interface Creator {
  handle: string;
  name: string;
  address: string;
  colors: [string, string];
  subscribers: number;
  memberPrice: string;
  bio: string;
}

export interface Post {
  id: string;
  title: string;
  creator: string;
  origin: Origin;
  model?: string;
  agent?: string;
  stampId: string;
  txHash?: string;
  views: number;
  postedAt: string;
  colors: [string, string];
  membersOnly: boolean;
  description: string;
  videoSrc?: string;
  duration?: string;
}

export const CREATORS: Creator[] = [
  {
    handle: 'cypher',
    name: 'Cypher Studio',
    address: '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
    colors: ['#836EF9', '#200052'],
    subscribers: 48200,
    memberPrice: '2',
    bio: 'Cyberpunk cityscapes and neon worlds. Agent-assisted, always stamped.',
  },
  {
    handle: 'dune',
    name: 'Dune Works',
    address: '0x7a2b4C1d9E8f3A6b5C4d3E2f1A0b9C8d7E6f5A4b',
    colors: ['#f59e0b', '#7c2d12'],
    subscribers: 12900,
    memberPrice: '1',
    bio: 'Desert surrealism. Mix of hand-painted pieces and SDXL studies.',
  },
  {
    handle: 'arch',
    name: 'Arch Lab',
    address: '0x3c5D7e9F1a2B4c6D8e0F1a3B5c7D9e1F2a4B6c8D',
    colors: ['#22d3ee', '#0c4a6e'],
    subscribers: 30500,
    memberPrice: '3',
    bio: 'Impossible architecture, generated and verified.',
  },
  {
    handle: 'nature',
    name: 'Ethereal Nature',
    address: '0x9e8D7c6B5a4F3e2D1c0B9a8F7e6D5c4B3a2F1e0D',
    colors: ['#34d399', '#064e3b'],
    subscribers: 8700,
    memberPrice: '1.5',
    bio: 'Forests that never existed. Human photography meets Gemini.',
  },
];

export const POSTS: Post[] = [
  {
    id: 'neon-nights',
    title: 'Neon Nights in Neo-Tokyo — full series',
    creator: 'cypher',
    origin: 'agent',
    model: 'Gemini Flash 2.0',
    agent: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    stampId: '3fa72c91aa',
    txHash: '0xabc123',
    views: 128400,
    postedAt: '2 hours ago',
    colors: ['#836EF9', '#0f172a'],
    membersOnly: false,
    description: 'A short motion study of a rain-soaked city, commissioned from a Gemini agent and stamped on Monad.',
    videoSrc: '/videos/neon-nights.mp4',
    duration: '0:10',
  },
  {
    id: 'last-oasis',
    title: 'The Last Oasis',
    creator: 'dune',
    origin: 'agent',
    model: 'Stable Diffusion XL',
    agent: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
    stampId: '7b1d4e82ff',
    txHash: '0xdef456',
    views: 45100,
    postedAt: '5 hours ago',
    colors: ['#f59e0b', '#431407'],
    membersOnly: true,
    description: 'An oasis at the end of the world. SDXL base with a custom desert fine-tune.',
  },
  {
    id: 'quantum-arch',
    title: 'Quantum Architecture: buildings that fold into themselves',
    creator: 'arch',
    origin: 'agent',
    model: 'DALL-E 3',
    agent: '0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB',
    stampId: 'c4a91f3b22',
    txHash: '0xghi789',
    views: 302000,
    postedAt: '1 day ago',
    colors: ['#22d3ee', '#1e1b4b'],
    membersOnly: false,
    description: 'A short motion study of non-Euclidean facades, made with DALL-E 3.',
    videoSrc: '/videos/quantum-arch.mp4',
    duration: '0:10',
  },
  {
    id: 'ethereal-forest',
    title: 'Ethereal Forest at dawn',
    creator: 'nature',
    origin: 'human',
    stampId: '9d2f1a8c01',
    txHash: '0xjkl012',
    views: 18300,
    postedAt: '1 day ago',
    colors: ['#34d399', '#022c22'],
    membersOnly: false,
    description: 'A short dawn loop, claimed on Monad as human-made work.',
    videoSrc: '/videos/ethereal-forest.mp4',
    duration: '0:10',
  },
  {
    id: 'found-on-x',
    title: 'Found this on X — turns out it was DALL-E',
    creator: 'arch',
    origin: 'external',
    model: 'DALL-E 3 (C2PA)',
    stampId: 'e1c0ffee42',
    views: 9100,
    postedAt: '2 days ago',
    colors: ['#64748b', '#0f172a'],
    membersOnly: false,
    description: 'A repost flagged by its C2PA manifest. Not stamped by STAMP, but the origin is still visible.',
  },
  {
    id: 'chrome-samurai',
    title: 'Chrome Samurai — members preview',
    creator: 'cypher',
    origin: 'agent',
    model: 'Stable Diffusion XL',
    agent: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
    stampId: 'a8b7c6d5e4',
    txHash: '0xmno345',
    views: 67000,
    postedAt: '3 days ago',
    colors: ['#f472b6', '#3b0764'],
    membersOnly: true,
    description: 'Members-only motion preview of a samurai in a cherry blossom forest.',
    videoSrc: '/videos/chrome-samurai.mp4',
    duration: '0:10',
  },
  {
    id: 'dune-sketches',
    title: 'Hand-drawn dune sketches (no AI)',
    creator: 'dune',
    origin: 'human',
    stampId: '5e4d3c2b1a',
    txHash: '0xpqr678',
    views: 5400,
    postedAt: '4 days ago',
    colors: ['#fbbf24', '#292524'],
    membersOnly: false,
    description: 'Ink on paper. Claimed on Monad so reposts can be traced back here.',
  },
  {
    id: 'mondrian',
    title: 'Abstract geometry in the style of Mondrian, ultra-HD',
    creator: 'arch',
    origin: 'agent',
    model: 'Gemini Flash 2.0',
    agent: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    stampId: 'b2c3d4e5f6',
    txHash: '0xstu901',
    views: 21700,
    postedAt: '1 week ago',
    colors: ['#ef4444', '#1d4ed8'],
    membersOnly: false,
    description: 'Primary colours and black grids, generated by a Gemini agent.',
  },
];

export function getCreator(handle: string) {
  return CREATORS.find((c) => c.handle === handle);
}

export function getPost(id: string) {
  return POSTS.find((p) => p.id === id);
}

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
