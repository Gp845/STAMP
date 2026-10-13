import { indexer, type ProvenanceRegistry_Stamped } from "envio";

indexer.onEvent({ contract: "ProvenanceRegistry", event: "Stamped" }, async ({ event, context }) => {
  const entity: ProvenanceRegistry_Stamped = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    stampId: event.params.id,
    contentHash: event.params.contentHash,
    model: event.params.model,
    agent: event.params.agent,
    creator: event.params.creator,
    kind: event.params.kind === 0n ? "ATTESTED" : "CLAIMED",
    timestamp: event.block.timestamp,
    band0: event.params.band0,
    band1: event.params.band1,
    band2: event.params.band2,
    band3: event.params.band3,
    band4: event.params.band4,
    band5: event.params.band5,
    band6: event.params.band6,
    band7: event.params.band7,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
  };

  context.ProvenanceRegistry_Stamped.set(entity);
});
