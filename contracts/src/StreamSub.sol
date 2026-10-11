// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice A membership that bills by the second. The fan deposits credit,
/// the creator earns `ratePerSecond` for each second it runs, and cancel
/// pays the creator what they earned and returns the rest to the fan.
contract StreamSub {
    struct Sub {
        address creator;
        uint256 ratePerSecond;
        uint256 deposit;
        uint256 start;
        bool active;
    }

    mapping(address fan => mapping(address creator => Sub)) public subs;

    event Subscribed(address indexed fan, address indexed creator, uint256 deposit, uint256 ratePerSecond);
    event Collected(address indexed fan, address indexed creator, uint256 amount);
    event Cancelled(address indexed fan, address indexed creator, uint256 paid, uint256 refunded);

    function subscribe(address creator, uint256 ratePerSecond) external payable {
        require(creator != address(0) && creator != msg.sender, "bad creator");
        require(ratePerSecond > 0, "rate is zero");
        require(msg.value > 0, "no credit");
        require(!subs[msg.sender][creator].active, "already a member");

        subs[msg.sender][creator] = Sub(creator, ratePerSecond, msg.value, block.timestamp, true);
        emit Subscribed(msg.sender, creator, msg.value, ratePerSecond);
    }

    function accrued(address fan, address creator) public view returns (uint256) {
        Sub storage s = subs[fan][creator];
        if (!s.active) return 0;
        uint256 owed = (block.timestamp - s.start) * s.ratePerSecond;
        return owed > s.deposit ? s.deposit : owed;
    }

    function collect(address fan) external {
        Sub storage s = subs[fan][msg.sender];
        require(s.active, "not active");
        uint256 earned = accrued(fan, msg.sender);
        require(earned > 0, "nothing due");

        s.deposit -= earned;
        s.start = block.timestamp;
        if (s.deposit == 0) s.active = false;
        emit Collected(fan, msg.sender, earned);

        payable(msg.sender).transfer(earned);
    }

    function cancel(address creator) external {
        Sub storage s = subs[msg.sender][creator];
        require(s.active, "not active");
        uint256 paid = accrued(msg.sender, creator);
        uint256 refunded = s.deposit - paid;

        s.active = false;
        s.deposit = 0;
        emit Cancelled(msg.sender, creator, paid, refunded);

        if (paid > 0) payable(creator).transfer(paid);
        if (refunded > 0) payable(msg.sender).transfer(refunded);
    }
}
