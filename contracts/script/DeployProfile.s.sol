// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ModelProfile.sol";

contract DeployProfile is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        ModelProfile profile = new ModelProfile(vm.envAddress("AGENT_REGISTRY"));
        vm.stopBroadcast();
        console.log("ModelProfile deployed at:", address(profile));
    }
}
