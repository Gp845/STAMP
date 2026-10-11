// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/ProvenanceRegistry.sol";
import "../src/JobEscrow.sol";
import "../src/StreamSub.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AgentRegistry agentRegistry = new AgentRegistry();
        ProvenanceRegistry provenanceRegistry = new ProvenanceRegistry();
        JobEscrow jobEscrow = new JobEscrow(address(agentRegistry), address(provenanceRegistry));
        StreamSub streamSub = new StreamSub();

        vm.stopBroadcast();

        console.log("AgentRegistry deployed at:", address(agentRegistry));
        console.log("ProvenanceRegistry deployed at:", address(provenanceRegistry));
        console.log("JobEscrow deployed at:", address(jobEscrow));
        console.log("StreamSub deployed at:", address(streamSub));
    }
}