// Contract ABIs and Monad testnet chain config
// Fill in addresses after deploying contracts

export const CONTRACTS = {
  agentRegistry: {
    address: (process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: [
      {
        name: 'agents',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'agentAddress', type: 'address' }],
        outputs: [
          { name: 'modelName', type: 'string' },
          { name: 'modelWeightsHash', type: 'string' },
          { name: 'stake', type: 'uint256' },
          { name: 'reputation', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
      {
        name: 'registerAgent',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: '_modelName', type: 'string' },
          { name: '_weightsHash', type: 'string' },
        ],
        outputs: [],
      },
      {
        name: 'AgentRegistered',
        type: 'event',
        inputs: [
          { name: 'agentAddress', type: 'address', indexed: true },
          { name: 'modelName', type: 'string', indexed: false },
          { name: 'stake', type: 'uint256', indexed: false },
        ],
      },
    ] as const,
  },

  modelProfile: {
    address: (process.env.NEXT_PUBLIC_MODEL_PROFILE_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
  },

  jobEscrow: {
    address: (process.env.NEXT_PUBLIC_JOB_ESCROW_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: [
      {
        name: 'createJob',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: '_agent', type: 'address' },
          { name: '_prompt', type: 'string' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
      },
      {
        name: 'settleJob',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: '_jobId', type: 'uint256' },
          { name: '_stampId', type: 'string' },
        ],
        outputs: [],
      },
      {
        name: 'jobs',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'jobId', type: 'uint256' }],
        outputs: [
          { name: 'creator', type: 'address' },
          { name: 'agent', type: 'address' },
          { name: 'payment', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'prompt', type: 'string' },
        ],
      },
      {
        name: 'JobCreated',
        type: 'event',
        inputs: [
          { name: 'jobId', type: 'uint256', indexed: true },
          { name: 'creator', type: 'address', indexed: true },
          { name: 'agent', type: 'address', indexed: true },
          { name: 'payment', type: 'uint256', indexed: false },
        ],
      },
      {
        name: 'JobSettled',
        type: 'event',
        inputs: [
          { name: 'jobId', type: 'uint256', indexed: true },
          { name: 'stampId', type: 'string', indexed: false },
        ],
      },
    ] as const,
  },

  streamSub: {
    address: (process.env.NEXT_PUBLIC_STREAM_SUB_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
  },

  provenanceRegistry: {
    address: (process.env.NEXT_PUBLIC_PROVENANCE_REGISTRY_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: [
      {
        name: 'stamps',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'id', type: 'string' }],
        outputs: [
          { name: 'contentHash', type: 'string' },
          { name: 'model', type: 'string' },
          { name: 'agent', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'kind', type: 'uint8' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'revoked', type: 'bool' },
        ],
      },
      {
        name: 'Stamped',
        type: 'event',
        inputs: [
          { name: 'id', type: 'string', indexed: true },
          { name: 'contentHash', type: 'string', indexed: false },
          { name: 'band0', type: 'string', indexed: false },
          { name: 'band1', type: 'string', indexed: false },
          { name: 'band2', type: 'string', indexed: false },
          { name: 'band3', type: 'string', indexed: false },
          { name: 'band4', type: 'string', indexed: false },
          { name: 'band5', type: 'string', indexed: false },
          { name: 'band6', type: 'string', indexed: false },
          { name: 'band7', type: 'string', indexed: false },
          { name: 'model', type: 'string', indexed: false },
          { name: 'agent', type: 'address', indexed: true },
          { name: 'creator', type: 'address', indexed: true },
          { name: 'kind', type: 'uint8', indexed: false },
        ],
      },
    ] as const,
  },
};

export const MONAD_TESTNET = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
    public: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
} as const;

const rpc = process.env.NEXT_PUBLIC_RPC_URL || MONAD_TESTNET.rpcUrls.default.http[0];
const local = Boolean(process.env.NEXT_PUBLIC_CHAIN_ID);

export const CHAIN = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || MONAD_TESTNET.id),
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || MONAD_TESTNET.name,
  nativeCurrency: MONAD_TESTNET.nativeCurrency,
  rpcUrls: { default: { http: [rpc] } },
  blockExplorers: process.env.NEXT_PUBLIC_EXPLORER_URL
    ? { default: { name: 'Explorer', url: process.env.NEXT_PUBLIC_EXPLORER_URL } }
    : local
      ? undefined
      : MONAD_TESTNET.blockExplorers,
};
