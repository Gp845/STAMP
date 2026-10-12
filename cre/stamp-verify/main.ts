import {
  bytesToHex,
  consensusIdenticalAggregation,
  encodeCallMsg,
  EVMClient,
  getNetwork,
  handler,
  HTTPCapability,
  HTTPClient,
  LAST_FINALIZED_BLOCK_NUMBER,
  Runner,
  type HTTPPayload,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"
import { decodeFunctionResult, encodeFunctionData, zeroAddress, type Address } from "viem"

type Config = {
  gatewayUrl: string
  chainName: string
  registry: string
}

type GatewayStamp = {
  found: boolean
  stampId: string
  contentHash: string
  model: string
  agent: string
  creator: string
  kind: "ATTESTED" | "CLAIMED"
  timestamp: number
}

const stampsAbi = [
  {
    type: "function",
    name: "stamps",
    stateMutability: "view",
    inputs: [{ name: "id", type: "string" }],
    outputs: [
      { name: "contentHash", type: "string" },
      { name: "model", type: "string" },
      { name: "agent", type: "address" },
      { name: "creator", type: "address" },
      { name: "kind", type: "uint8" },
      { name: "timestamp", type: "uint256" },
      { name: "revoked", type: "bool" },
    ],
  },
] as const

const initWorkflow = (_config: Config) => {
  const http = new HTTPCapability()
  // Empty keys are valid for `cre workflow simulate`. A deployed workflow needs authorizedKeys.
  return [handler(http.trigger({}), onHttpTrigger)]
}

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const raw = new TextDecoder().decode(payload.input)
  const parsed = JSON.parse(raw) as { stampId?: string; input?: { stampId?: string } }
  const stampId = parsed.stampId || parsed.input?.stampId
  if (!stampId) return JSON.stringify({ match: false })
  runtime.log(`CRE verify ${stampId}`)

  const offchain = runtime
    .runInNodeMode((nodeRuntime: NodeRuntime<Config>): string => {
      const httpClient = new HTTPClient()
      const resp = httpClient
        .sendRequest(nodeRuntime, {
          url: `${nodeRuntime.config.gatewayUrl}/cre/stamp/${stampId}`,
          method: "GET" as const,
        })
        .result()
      return new TextDecoder().decode(resp.body)
    }, consensusIdenticalAggregation())()
    .result()

  const gateway = JSON.parse(offchain) as GatewayStamp
  let chainHash = ""
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainName })
  if (network) {
    try {
      const evmClient = new EVMClient(network.chainSelector.selector)
      const callData = encodeFunctionData({ abi: stampsAbi, functionName: "stamps", args: [stampId] })
      const reply = evmClient
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: runtime.config.registry as Address,
            data: callData,
          }),
          blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
        })
        .result()
      const decoded = decodeFunctionResult({
        abi: stampsAbi,
        functionName: "stamps",
        data: bytesToHex(reply.data),
      }) as readonly [string, string, string, string, number, bigint, boolean]
      chainHash = decoded[0]
    } catch (err) {
      // shortcut: Anvil is not a CRE chain selector, so the gateway's registry read stands. Upgrade on a named CRE chain.
      runtime.log(`onchain read unavailable: ${err}`)
    }
  }

  const match = gateway.found && gateway.timestamp > 0 && (chainHash === "" || chainHash === gateway.contentHash)
  return JSON.stringify({
    match,
    record: match
      ? {
          id: gateway.stampId,
          stampId: gateway.stampId,
          contentHash: gateway.contentHash,
          model: gateway.model,
          agent: gateway.agent,
          creator: gateway.creator,
          kind: gateway.kind,
          timestamp: gateway.timestamp,
          txHash: "",
          blockNumber: 0,
        }
      : null,
  })
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
