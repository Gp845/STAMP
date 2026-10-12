import { CHAIN, CONTRACTS } from './contracts';

const ZERO = '0x0000000000000000000000000000000000000000';
const CHAIN_ID = `0x${CHAIN.id.toString(16)}`;
// keccak256 selectors
const REGISTER_SELECTOR = 'ff17aca4';
const AGENTS_SELECTOR = 'fd66091e';
const CREATE_JOB = '3c6a1c67';
const SUBSCRIBE = '8de69284';
const CANCEL = '4c33fe94';
const REGISTERED_TOPIC = '0x023c5efe572c42192271951adb0e77f97d7fc84bc761d026189ac08617346824';
const JOB_CREATED = '0x8f4ee83cefe0dfb2f73fe6057bfa5b233fc43358bbb5f5606f444cbd4c5c4f8c';
const TEN_MON = '0x8ac7230489e80000';
const JOB_PRICE = '0xb1a2bc2ec50000';

export const REGISTRY_READY = CONTRACTS.agentRegistry.address !== ZERO;
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

function encodeRegister(modelName: string, weightsHash: string) {
  const first = encodeString(modelName);
  const second = encodeString(weightsHash);
  const offset1 = (64).toString(16).padStart(64, '0');
  const offset2 = (64 + first.length / 2).toString(16).padStart(64, '0');
  return `0x${REGISTER_SELECTOR}${offset1}${offset2}${first}${second}`;
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

function formatMon(wei: bigint) {
  const whole = wei / MON;
  const frac = (wei % MON).toString().padStart(18, '0').slice(0, 2).replace(/0+$/, '');
  return frac ? `${whole.toString()}.${frac}` : whole.toString();
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
        data: encodeRegister(modelName, weightsHash),
      },
    ],
  })) as string;
  await waitReceipt(hash);
  return hash;
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

export async function loadChainAgents(): Promise<ChainAgent[]> {
  if (!REGISTRY_READY) return [];
  const logs = (await rpc('eth_getLogs', [
    { address: CONTRACTS.agentRegistry.address, fromBlock: '0x0', topics: [REGISTERED_TOPIC] },
  ])) as { topics: string[] }[];

  const addresses = [...new Set(logs.map((log) => `0x${log.topics[1].slice(26)}`))];
  return Promise.all(
    addresses.map(async (address) => {
      const data = `0x${AGENTS_SELECTOR}${address.slice(2).padStart(64, '0')}`;
      const raw = (await rpc('eth_call', [{ to: CONTRACTS.agentRegistry.address, data }, 'latest'])) as string;
      const word = (i: number) => BigInt(`0x${raw.slice(2 + i * 64, 2 + (i + 1) * 64)}`);
      const active = word(4) === BigInt(1);
      return {
        address,
        modelName: decodeString(raw, Number(word(0))),
        weightsHash: decodeString(raw, Number(word(1))),
        stake: formatMon(word(2)),
        reputation: Number(word(3)),
        isActive: active,
      };
    }),
  ).then((agents) => agents.filter((agent) => agent.isActive));
}
