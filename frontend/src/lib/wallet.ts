import { CHAIN, CONTRACTS } from './contracts';

const ZERO = '0x0000000000000000000000000000000000000000';
const CHAIN_ID = `0x${CHAIN.id.toString(16)}`;
// keccak256 selectors
const REGISTER_SELECTOR = 'ff17aca4';
const UPDATE_SELECTOR = '7aa632e1';
const PROFILES_SELECTOR = 'bbe15627';
const AGENTS_SELECTOR = 'fd66091e';
const CREATE_JOB = '3c6a1c67';
const SUBSCRIBE = '8de69284';
const CANCEL = '4c33fe94';
const COLLECT = '06ec16f8';
const SUBS_SELECTOR = 'cd755b41';
const SUBSCRIBED_TOPIC = '0x7f167950d6405e671782a5bac6c60bd0453dacbcc537d8b456f2d78b1e1751f6';
const REGISTERED_TOPIC = '0x023c5efe572c42192271951adb0e77f97d7fc84bc761d026189ac08617346824';
const JOB_CREATED = '0x8f4ee83cefe0dfb2f73fe6057bfa5b233fc43358bbb5f5606f444cbd4c5c4f8c';
const TEN_MON = '0x8ac7230489e80000';
const JOB_PRICE = '0xb1a2bc2ec50000';

export const REGISTRY_READY = CONTRACTS.agentRegistry.address !== ZERO;
export const PROFILE_READY = CONTRACTS.modelProfile.address !== ZERO;
export const ESCROW_READY = CONTRACTS.jobEscrow.address !== ZERO;
export const SUBS_READY = CONTRACTS.streamSub.address !== ZERO;

interface Ethereum {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function provider(): Ethereum {
  const eth = (window as unknown as { ethereum?: Ethereum }).ethereum;
  if (!eth) throw new Error('No wallet found. Install MetaMask or another injected wallet.');
  return eth;
}

function encodeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const length = bytes.length.toString(16).padStart(64, '0');
  let data = '';
  for (const byte of bytes) data += byte.toString(16).padStart(2, '0');
  return length + data + '0'.repeat((64 - (data.length % 64)) % 64);
}

function encodeStrings(selector: string, modelName: string, weightsHash: string) {
  const first = encodeString(modelName);
  const second = encodeString(weightsHash);
  const offset1 = (64).toString(16).padStart(64, '0');
  const offset2 = (64 + first.length / 2).toString(16).padStart(64, '0');
  return `0x${selector}${offset1}${offset2}${first}${second}`;
}

function decodeString(data: string, offsetBytes: number) {
  const start = 2 + offsetBytes * 2;
  const length = Number.parseInt(data.slice(start, start + 64), 16);
  const hex = data.slice(start + 64, start + 64 + length * 2);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
}

const MON = BigInt(10) ** BigInt(18);

export function formatWei(wei: bigint) {
  const whole = wei / MON;
  const frac = (wei % MON).toString().padStart(18, '0').slice(0, 2).replace(/0+$/, '');
  return frac ? `${whole.toString()}.${frac}` : whole.toString();
}

export async function currentAccount() {
  const eth = (window as unknown as { ethereum?: Ethereum }).ethereum;
  if (!eth) return null;
  const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
  return accounts[0] ?? null;
}

export async function connectWallet() {
  const eth = provider();
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  const chain = {
    chainId: CHAIN_ID,
    chainName: CHAIN.name,
    nativeCurrency: CHAIN.nativeCurrency,
    rpcUrls: [...CHAIN.rpcUrls.default.http],
    ...(CHAIN.blockExplorers ? { blockExplorerUrls: [CHAIN.blockExplorers.default.url] } : {}),
  };
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] });
  } catch (err) {
    if ((err as { code?: number }).code !== 4902) throw err;
    await eth.request({ method: 'wallet_addEthereumChain', params: [chain] });
  }
  return accounts[0];
}

async function waitReceipt(hash: string) {
  const eth = provider();
  for (let i = 0; i < 30; i++) {
    const receipt = (await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as {
      status?: string;
      logs?: { topics: string[] }[];
    } | null;
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('Transaction reverted');
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Timed out waiting for the transaction');
}

function pad(value: string) {
  return value.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

export interface ChainAgent {
  address: string;
  modelName: string;
  weightsHash: string;
  stake: string;
  reputation: number;
  isActive: boolean;
}

export async function registerAgent(modelName: string, weightsHash: string) {
  if (!REGISTRY_READY) throw new Error('The agent registry contract address is not set.');
  const from = await connectWallet();
  const eth = provider();
  const hash = (await eth.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: CONTRACTS.agentRegistry.address,
        value: TEN_MON,
        data: encodeStrings(REGISTER_SELECTOR, modelName, weightsHash),
      },
    ],
  })) as string;
  await waitReceipt(hash);
  return hash;
}

export async function updateModel(modelName: string, weightsHash: string) {
  if (!PROFILE_READY) throw new Error('The model profile contract address is not set.');
  const from = await connectWallet();
  const hash = (await provider().request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: CONTRACTS.modelProfile.address,
      data: encodeStrings(UPDATE_SELECTOR, modelName, weightsHash),
    }],
  })) as string;
  await waitReceipt(hash);
  return hash;
}

async function savedProfile(address: string) {
  if (!PROFILE_READY) return null;
  const data = `0x${PROFILES_SELECTOR}${address.slice(2).padStart(64, '0')}`;
  const raw = (await rpc('eth_call', [{ to: CONTRACTS.modelProfile.address, data }, 'latest'])) as string;
  if (!raw || raw === '0x') return null;
  const word = (i: number) => BigInt(`0x${raw.slice(2 + i * 64, 2 + (i + 1) * 64)}`);
  if (word(2) !== BigInt(1)) return null;
  return {
    modelName: decodeString(raw, Number(word(0))),
    weightsHash: decodeString(raw, Number(word(1))),
  };
}

export async function createJob(agent: string, prompt: string) {
  if (!ESCROW_READY) throw new Error('The job escrow contract address is not set.');
  const from = await connectWallet();
  const eth = provider();
  const data = `0x${CREATE_JOB}${pad(agent)}${pad('40')}${encodeString(prompt)}`;
  const hash = (await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: CONTRACTS.jobEscrow.address, value: JOB_PRICE, data }],
  })) as string;
  const receipt = await waitReceipt(hash);
  const log = receipt.logs?.find((item) => item.topics[0]?.toLowerCase() === JOB_CREATED);
  if (!log) throw new Error('Job was paid but the receipt had no job id');
  return { hash, jobId: BigInt(log.topics[1]).toString(), from };
}

export async function subscribeOnChain(creator: string, rateWei: bigint, valueWei: bigint) {
  if (!SUBS_READY) throw new Error('The membership contract address is not set.');
  const from = await connectWallet();
  const data = `0x${SUBSCRIBE}${pad(creator)}${pad(rateWei.toString(16))}`;
  const hash = (await provider().request({
    method: 'eth_sendTransaction',
    params: [{ from, to: CONTRACTS.streamSub.address, value: `0x${valueWei.toString(16)}`, data }],
  })) as string;
  await waitReceipt(hash);
}

export async function collectFrom(fan: string) {
  if (!SUBS_READY) throw new Error('The membership contract address is not set.');
  const from = await connectWallet();
  const hash = (await provider().request({
    method: 'eth_sendTransaction',
    params: [{ from, to: CONTRACTS.streamSub.address, data: `0x${COLLECT}${pad(fan)}` }],
  })) as string;
  await waitReceipt(hash);
}

export async function cancelOnChain(creator: string) {
  if (!SUBS_READY) throw new Error('The membership contract address is not set.');
  const from = await connectWallet();
  const data = `0x${CANCEL}${pad(creator)}`;
  const hash = (await provider().request({
    method: 'eth_sendTransaction',
    params: [{ from, to: CONTRACTS.streamSub.address, data }],
  })) as string;
  await waitReceipt(hash);
}

async function rpc(method: string, params: unknown[]) {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

const LOG_SPAN = 100;
// shortcut: Monad's public RPC rejects eth_getLogs wider than 100 blocks, raise the span if that limit changes.
const REGISTRY_BIRTH = CHAIN.id === 10143 ? 70443261 : 0;
const AGENT_CACHE = 'stamp-agent-scan';

async function registrationAddresses(): Promise<string[]> {
  const latest = Number(await rpc('eth_blockNumber', []));
  let from = REGISTRY_BIRTH;
  let known: string[] = [];
  try {
    const saved = JSON.parse(localStorage.getItem(AGENT_CACHE) || '');
    if (saved?.chain === CHAIN.id && saved.block >= REGISTRY_BIRTH && saved.block <= latest) {
      from = saved.block + 1;
      known = saved.addresses;
    }
  } catch {
    known = [];
  }
  const ranges: [number, number][] = [];
  for (let start = from; start <= latest; start += LOG_SPAN) {
    ranges.push([start, Math.min(latest, start + LOG_SPAN - 1)]);
  }
  const logs: { topics: string[] }[] = [];
  for (let i = 0; i < ranges.length; i += 8) {
    const batch = await Promise.all(
      ranges.slice(i, i + 8).map(([start, end]) =>
        rpc('eth_getLogs', [
          {
            address: CONTRACTS.agentRegistry.address,
            fromBlock: `0x${start.toString(16)}`,
            toBlock: `0x${end.toString(16)}`,
            topics: [REGISTERED_TOPIC],
          },
        ]),
      ),
    );
    for (const part of batch) logs.push(...(part as { topics: string[] }[]));
  }
  const addresses = [...new Set([...known, ...logs.map((log) => `0x${log.topics[1].slice(26)}`)])];
  localStorage.setItem(AGENT_CACHE, JSON.stringify({ chain: CHAIN.id, block: latest, addresses }));
  return addresses;
}

export async function loadChainAgents(): Promise<ChainAgent[]> {
  if (!REGISTRY_READY) return [];
  const addresses = await registrationAddresses();
  return Promise.all(
    addresses.map(async (address) => {
      const data = `0x${AGENTS_SELECTOR}${address.slice(2).padStart(64, '0')}`;
      const raw = (await rpc('eth_call', [{ to: CONTRACTS.agentRegistry.address, data }, 'latest'])) as string;
      const word = (i: number) => BigInt(`0x${raw.slice(2 + i * 64, 2 + (i + 1) * 64)}`);
      const active = word(4) === BigInt(1);
      const profile = await savedProfile(address);
      return {
        address,
        modelName: profile?.modelName || decodeString(raw, Number(word(0))),
        weightsHash: profile?.weightsHash || decodeString(raw, Number(word(1))),
        stake: formatWei(word(2)),
        reputation: Number(word(3)),
        isActive: active,
      };
    }),
  ).then((agents) => agents.filter((agent) => agent.isActive));
}

const JOBS_SELECTOR = '180aedf3';
const JOB_COUNTER = '50355d76';
const SETTLED_TOPIC = '0x98b83067fc4f0325071247db516cc8f27364e617a56f33fa1f90a9bd6175a769';
const JOB_STATUS = ['Open', 'Active', 'Completed', 'Disputed', 'Refunded'];

export interface ChainJob {
  id: string;
  creator: string;
  agent: string;
  payment: string;
  status: string;
  prompt: string;
  stampId: string;
}

async function settledStamps(): Promise<Record<string, string>> {
  const latest = Number(await rpc('eth_blockNumber', []));
  let from = REGISTRY_BIRTH;
  let known: Record<string, string> = {};
  try {
    const saved = JSON.parse(localStorage.getItem('stamp-job-scan') || '');
    if (saved?.chain === CHAIN.id && saved.block >= REGISTRY_BIRTH && saved.block <= latest) {
      from = saved.block + 1;
      known = saved.stamps;
    }
  } catch {
    known = {};
  }
  const ranges: [number, number][] = [];
  for (let start = from; start <= latest; start += LOG_SPAN) {
    ranges.push([start, Math.min(latest, start + LOG_SPAN - 1)]);
  }
  const stamps = { ...known };
  for (let i = 0; i < ranges.length; i += 8) {
    const batch = await Promise.all(
      ranges.slice(i, i + 8).map(([start, end]) =>
        rpc('eth_getLogs', [
          {
            address: CONTRACTS.jobEscrow.address,
            fromBlock: `0x${start.toString(16)}`,
            toBlock: `0x${end.toString(16)}`,
            topics: [SETTLED_TOPIC],
          },
        ]),
      ),
    );
    for (const part of batch) {
      for (const log of part as { topics: string[]; data: string }[]) {
        stamps[BigInt(log.topics[1]).toString()] = decodeString(log.data, 32);
      }
    }
  }
  localStorage.setItem('stamp-job-scan', JSON.stringify({ chain: CHAIN.id, block: latest, stamps }));
  return stamps;
}

export async function loadChainJobs(): Promise<ChainJob[]> {
  if (!ESCROW_READY) return [];
  const countHex = (await rpc('eth_call', [
    { to: CONTRACTS.jobEscrow.address, data: `0x${JOB_COUNTER}` },
    'latest',
  ])) as string;
  const count = Number(BigInt(countHex));
  const stamps = await settledStamps();
  const jobs: ChainJob[] = [];
  for (let i = 0; i < count; i++) {
    const data = `0x${JOBS_SELECTOR}${i.toString(16).padStart(64, '0')}`;
    const raw = (await rpc('eth_call', [{ to: CONTRACTS.jobEscrow.address, data }, 'latest'])) as string;
    const word = (n: number) => BigInt(`0x${raw.slice(2 + n * 64, 2 + (n + 1) * 64)}`);
    const status = Number(word(3));
    jobs.push({
      id: String(i),
      creator: `0x${raw.slice(26, 66)}`,
      agent: `0x${raw.slice(2 + 64 + 24, 2 + 128)}`,
      payment: formatWei(word(2)),
      status: JOB_STATUS[status] || String(status),
      prompt: decodeString(raw, Number(word(4))),
      stampId: stamps[String(i)] || '',
    });
  }
  return jobs.reverse();
}

export interface IncomingMember {
  fan: string;
  creator: string;
  depositWei: string;
  rateWei: string;
  start: number;
}

async function subscriptionPairs(): Promise<{ fan: string; creator: string }[]> {
  if (!SUBS_READY) return [];
  const latest = Number(await rpc('eth_blockNumber', []));
  let from = REGISTRY_BIRTH;
  let known: { fan: string; creator: string }[] = [];
  try {
    const saved = JSON.parse(localStorage.getItem('stamp-sub-scan') || '');
    if (saved?.chain === CHAIN.id && saved.block >= REGISTRY_BIRTH && saved.block <= latest) {
      from = saved.block + 1;
      known = saved.pairs;
    }
  } catch {
    known = [];
  }
  const ranges: [number, number][] = [];
  for (let start = from; start <= latest; start += LOG_SPAN) {
    ranges.push([start, Math.min(latest, start + LOG_SPAN - 1)]);
  }
  const pairs = [...known];
  for (let i = 0; i < ranges.length; i += 8) {
    const batch = await Promise.all(
      ranges.slice(i, i + 8).map(([start, end]) =>
        rpc('eth_getLogs', [
          {
            address: CONTRACTS.streamSub.address,
            fromBlock: `0x${start.toString(16)}`,
            toBlock: `0x${end.toString(16)}`,
            topics: [SUBSCRIBED_TOPIC],
          },
        ]),
      ),
    );
    for (const part of batch) {
      for (const log of part as { topics: string[] }[]) {
        pairs.push({ fan: `0x${log.topics[1].slice(26)}`, creator: `0x${log.topics[2].slice(26)}` });
      }
    }
  }
  localStorage.setItem('stamp-sub-scan', JSON.stringify({ chain: CHAIN.id, block: latest, pairs }));
  return pairs;
}

async function readMembership(fan: string, creator: string): Promise<IncomingMember | null> {
  const data = `0x${SUBS_SELECTOR}${pad(fan)}${pad(creator)}`;
  const raw = (await rpc('eth_call', [{ to: CONTRACTS.streamSub.address, data }, 'latest'])) as string;
  if (!raw || raw.length < 2 + 64 * 5) return null;
  const word = (i: number) => BigInt(`0x${raw.slice(2 + i * 64, 2 + (i + 1) * 64)}`);
  if (word(4) !== BigInt(1)) return null;
  return { fan, creator, depositWei: word(2).toString(), rateWei: word(1).toString(), start: Number(word(3)) };
}

export function loadMembership(fan: string, creator: string) {
  return readMembership(fan, creator);
}

async function activeMemberships(pairs: { fan: string; creator: string }[]) {
  const seen = new Set<string>();
  const unique = pairs.filter((pair) => {
    const key = `${pair.fan.toLowerCase()}:${pair.creator.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rows = await Promise.all(unique.map((pair) => readMembership(pair.fan, pair.creator)));
  return rows.filter((row): row is IncomingMember => row !== null);
}

export async function loadIncoming(creator: string) {
  const pairs = await subscriptionPairs();
  const mine = pairs.filter((pair) => pair.creator.toLowerCase() === creator.toLowerCase());
  return activeMemberships(mine);
}

export async function loadFanSubs(fan: string) {
  const pairs = await subscriptionPairs();
  const mine = pairs.filter((pair) => pair.fan.toLowerCase() === fan.toLowerCase());
  return activeMemberships(mine);
}
