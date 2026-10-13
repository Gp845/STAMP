// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentRegistry {
    function agents(address agentAddress) external view returns (
        string memory modelName,
        string memory modelWeightsHash,
        uint256 stake,
        uint256 reputation,
        bool isActive
    );
}

/// Model name and weights hash for an agent wallet. The wallet stays the identity.
contract ModelProfile {
    struct Profile {
        string modelName;
        string weightsHash;
        bool set;
    }

    IAgentRegistry public immutable registry;
    mapping(address => Profile) public profiles;

    event ModelUpdated(address indexed agent, string modelName, string weightsHash);

    constructor(address registryAddress) {
        registry = IAgentRegistry(registryAddress);
    }

    function updateModel(string calldata modelName, string calldata weightsHash) external {
        (, , , , bool active) = registry.agents(msg.sender);
        require(active, "not an agent");
        require(bytes(modelName).length > 0 && bytes(weightsHash).length > 0, "model required");

        profiles[msg.sender] = Profile({modelName: modelName, weightsHash: weightsHash, set: true});
        emit ModelUpdated(msg.sender, modelName, weightsHash);
    }
}
