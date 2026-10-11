// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/StreamSub.sol";

contract StreamSubTest is Test {
    StreamSub sub;
    address fan = makeAddr("fan");
    address creator = makeAddr("creator");

    function setUp() public {
        sub = new StreamSub();
        vm.deal(fan, 10 ether);
    }

    function test_billsByTheSecondAndRefundsTheRest() public {
        vm.prank(fan);
        sub.subscribe{value: 10 ether}(creator, 1 ether);

        vm.warp(block.timestamp + 4);
        assertEq(sub.accrued(fan, creator), 4 ether);

        vm.prank(fan);
        sub.cancel(creator);

        assertEq(creator.balance, 4 ether);
        assertEq(fan.balance, 6 ether);
        assertEq(sub.accrued(fan, creator), 0);
    }

    function test_neverChargesMoreThanTheDeposit() public {
        vm.prank(fan);
        sub.subscribe{value: 10 ether}(creator, 1 ether);

        vm.warp(block.timestamp + 100);
        assertEq(sub.accrued(fan, creator), 10 ether);

        vm.prank(fan);
        sub.cancel(creator);
        assertEq(creator.balance, 10 ether);
        assertEq(fan.balance, 0);
    }

    function test_creatorCanCollectWithoutEndingIt() public {
        vm.prank(fan);
        sub.subscribe{value: 10 ether}(creator, 1 ether);
        vm.warp(block.timestamp + 3);

        vm.prank(creator);
        sub.collect(fan);

        assertEq(creator.balance, 3 ether);
        assertEq(sub.accrued(fan, creator), 0);

        vm.warp(block.timestamp + 2);
        assertEq(sub.accrued(fan, creator), 2 ether);
    }
}
