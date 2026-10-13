// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/ModelProfile.sol";

contract ModelProfileTest is Test {
    AgentRegistry registry;
    ModelProfile profile;
    address agent = makeAddr("agent");

    function setUp() public {
        registry = new AgentRegistry();
        profile = new ModelProfile(address(registry));
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        registry.registerAgent{value: 10 ether}("old", "sha256:aa");
    }

    function test_agentCanChangeModelWithoutANewStake() public {
        vm.prank(agent);
        profile.updateModel("Qwen Image", "sha256:bb");

        (string memory name, string memory hash, bool set) = profile.profiles(agent);
        assertEq(name, "Qwen Image");
        assertEq(hash, "sha256:bb");
        assertTrue(set);

        (string memory registered,,,, bool active) = registry.agents(agent);
        assertEq(registered, "old");
        assertTrue(active);
        assertEq(agent.balance, 0);
    }

    function test_unregisteredWalletCannotSetAModel() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(bytes("not an agent"));
        profile.updateModel("Qwen Image", "sha256:bb");
    }
}
