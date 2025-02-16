import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  BIGINT_ONE,
  BIGINT_ZERO,
  GOVERNANCE_TYPE,
  NA,
  ProposalState,
} from "../../../src/constants";
import {
  getGovernance,
  getOrCreateProposal,
  _handleProposalCanceled,
  _handleProposalCreated,
  _handleProposalExecuted,
  _handleProposalQueued,
  _handleVoteEmitted,
} from "../../../src/handlers";
import {
  DydxGovernor,
  ProposalCanceled,
  ProposalCreated,
  ProposalExecuted,
  ProposalQueued,
  VoteEmitted,
  VotingDelayChanged,
} from "../../../generated/DydxGovernor/DydxGovernor";
import { Executor } from "../../../generated/DydxGovernor/Executor";
import { GovernanceStrategy } from "../../../generated/DydxGovernor/GovernanceStrategy";
import { GovernanceFramework } from "../../../generated/schema";

export function handleProposalCanceled(event: ProposalCanceled): void {
  _handleProposalCanceled(event.params.id.toString(), event);
}

export function handleProposalCreated(event: ProposalCreated): void {
  let executor = event.params.executor;
  let quorumVotes = getQuorumFromContract(
    event.address,
    executor,
    event.block.number.minus(BIGINT_ONE)
  );

  _handleProposalCreated(
    event.params.id.toString(),
    event.params.creator.toHexString(),
    executor.toHexString(),
    event.params.targets,
    event.params.values,
    event.params.signatures,
    event.params.calldatas,
    event.params.startBlock,
    event.params.endBlock,
    event.params.ipfsHash,
    quorumVotes,
    event
  );
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  _handleProposalExecuted(event.params.id.toString(), event);
}

export function handleProposalQueued(event: ProposalQueued): void {
  _handleProposalQueued(event.params.id.toString(), event.params.executionTime);
}

export function handleVoteEmitted(event: VoteEmitted): void {
  let proposal = getOrCreateProposal(event.params.id.toString());

  // if state is pending (i.e. the first vote), set state, quorum, delegates and tokenholders
  if (proposal.state == ProposalState.PENDING) {
    proposal.state = ProposalState.ACTIVE;
    // Set snapshot for quorum, tokenholders and delegates
    proposal.quorumVotes = getQuorumFromContract(
      event.address,
      Address.fromString(proposal.executor),
      event.block.number.minus(BIGINT_ONE)
    );
    let governance = getGovernance();
    proposal.tokenHoldersAtStart = governance.currentTokenHolders;
    proposal.delegatesAtStart = governance.currentDelegates;
  }

  // Proposal will be updated as part of handler
  _handleVoteEmitted(
    proposal,
    event.params.voter.toHexString(),
    event.params.votingPower,
    event.params.support,
    event
  );
}

// VotingDelayChanged (newVotingDelay, initiatorChange)
export function handleVotingDelayChanged(event: VotingDelayChanged): void {
  let governanceFramework = getGovernanceFramework(event.address.toHexString());
  governanceFramework.votingDelay = event.params.newVotingDelay;
  governanceFramework.save();
}

// Helper function that imports and binds the contract
function getGovernanceFramework(contractAddress: string): GovernanceFramework {
  let governanceFramework = GovernanceFramework.load(contractAddress);

  if (!governanceFramework) {
    governanceFramework = new GovernanceFramework(contractAddress);
    let contract = DydxGovernor.bind(Address.fromString(contractAddress));
    governanceFramework.name = contract.EIP712_DOMAIN_NAME();
    governanceFramework.type = GOVERNANCE_TYPE;
    governanceFramework.version = NA;

    governanceFramework.contractAddress = contractAddress;
    governanceFramework.tokenAddress =
      "0x92D6C1e31e14520e676a687F0a93788B716BEff5";
    governanceFramework.timelockAddress =
      "0x64c7d40c07EFAbec2AafdC243bF59eaF2195c6dc";

    // Init as zero, as govStrat / executor contracts are not deployed yet
    // values will be updated when proposal voting starts
    governanceFramework.votingPeriod = BIGINT_ZERO;
    governanceFramework.proposalThreshold = BIGINT_ZERO;
    governanceFramework.votingDelay = contract.getVotingDelay();
  }

  return governanceFramework;
}
function getQuorumFromContract(
  contractAddress: Address,
  executorAddress: Address,
  blockNumber: BigInt
): BigInt {
  // Get govStrat contract address
  let contract = DydxGovernor.bind(contractAddress);
  let govStratAddress = contract.getGovernanceStrategy();
  // Get totalVotingSuppy from GovStrat contract
  let governanceStrategyContract = GovernanceStrategy.bind(govStratAddress);
  let totalVotingSupply = governanceStrategyContract.getTotalVotingSupplyAt(
    blockNumber.minus(BIGINT_ONE)
  );
  // Get minimum voting power from Executor contract
  let executorContract = Executor.bind(executorAddress);
  return executorContract.getMinimumVotingPowerNeeded(totalVotingSupply);
}
