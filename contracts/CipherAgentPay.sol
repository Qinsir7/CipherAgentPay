// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title CipherAgentPay
/// @notice The encrypted policy layer for autonomous AI agent treasuries.
///
/// CipherAgentPay sits between an owner (CFO / DAO / human-in-the-loop) and one
/// or more autonomous agents. Budgets, per-payment caps, total spend caps, and
/// running spend totals live on-chain as FHE ciphertext and are evaluated
/// homomorphically inside this contract. Only addresses that the owner has
/// explicitly granted ACL permission to (the owner itself, an optional
/// auditor, and merchants for their own revenue) can decrypt the data they
/// need. Everyone else sees ciphertext handles only.
///
/// Composability: this contract is intentionally token-agnostic. v0.1
/// enforces against an internal encrypted balance that the owner tops up.
/// v0.x integrates with confidential token standards (ERC-7984 / cUSDC) so the
/// same policy layer can govern any encrypted asset rail.
contract CipherAgentPay is ZamaEthereumConfig {
    struct AgentAccount {
        address owner;
        address agent;
        address auditor;
        bool initialized;
        bool paused;
        euint64 balance;
        euint64 perPaymentLimit;
        euint64 totalSpendLimit;
        euint64 totalSpent;
        euint64 lastPaymentAmount;
        ebool lastPaymentApproved;
    }

    mapping(address owner => AgentAccount account) private _accounts;
    mapping(address owner => mapping(address merchant => bool allowed)) public allowedMerchant;
    mapping(address owner => uint256 nonce) public paymentNonce;
    mapping(address merchant => euint64 revenue) private _merchantRevenue;
    mapping(address merchant => bool initialized) private _merchantRevenueInitialized;

    event PolicyCreated(address indexed owner, address indexed agent, address indexed initialMerchant);
    event PolicyRotated(address indexed owner, address indexed agent);
    event PolicyPaused(address indexed owner, bool paused);
    event MerchantUpdated(address indexed owner, address indexed merchant, bool allowed);
    event AuditorUpdated(address indexed owner, address indexed auditor);
    event PaymentEvaluated(
        address indexed owner,
        address indexed agent,
        address indexed merchant,
        uint256 paymentId
    );
    event TreasuryFunded(address indexed owner);

    error InvalidAgent();
    error PolicyAlreadyInitialized();
    error PolicyNotInitialized();
    error MerchantNotAllowed();
    error NotAgent();
    error PolicyIsPaused();

    modifier onlyAgentOf(address owner) {
        if (msg.sender != _accounts[owner].agent) revert NotAgent();
        _;
    }

    /// @notice Create the encrypted policy for `msg.sender`'s agent.
    /// @dev `agent` is the autonomous executor authorised to call requestPayment.
    /// @dev `initialMerchant` may be `address(0)` to skip the initial allowlist entry.
    function createAgent(
        address agent,
        address initialMerchant,
        externalEuint64 initialBudget,
        externalEuint64 perPaymentLimit_,
        externalEuint64 totalSpendLimit_,
        bytes calldata inputProof
    ) external {
        if (agent == address(0)) revert InvalidAgent();
        if (_accounts[msg.sender].initialized) revert PolicyAlreadyInitialized();

        _writePolicy(
            msg.sender,
            agent,
            initialBudget,
            perPaymentLimit_,
            totalSpendLimit_,
            inputProof
        );

        if (initialMerchant != address(0)) {
            allowedMerchant[msg.sender][initialMerchant] = true;
            emit MerchantUpdated(msg.sender, initialMerchant, true);
        }

        emit PolicyCreated(msg.sender, agent, initialMerchant);
    }

    /// @notice Replace the encrypted policy for an existing owner.
    /// @dev Resets running totals (totalSpent / lastPayment*) so a new
    ///      budget cycle starts cleanly. Auditor and merchant allowlist are
    ///      preserved.
    function rotatePolicy(
        address agent,
        externalEuint64 newBudget,
        externalEuint64 newPerPaymentLimit,
        externalEuint64 newTotalSpendLimit,
        bytes calldata inputProof
    ) external {
        if (agent == address(0)) revert InvalidAgent();
        if (!_accounts[msg.sender].initialized) revert PolicyNotInitialized();

        _writePolicy(
            msg.sender,
            agent,
            newBudget,
            newPerPaymentLimit,
            newTotalSpendLimit,
            inputProof
        );

        emit PolicyRotated(msg.sender, agent);
    }

    /// @notice Top up the encrypted balance and total spend cap of an agent.
    function fundAgent(externalEuint64 amount, bytes calldata inputProof) external {
        AgentAccount storage account = _accounts[msg.sender];
        if (!account.initialized) revert PolicyNotInitialized();

        euint64 encryptedAmount = FHE.fromExternal(amount, inputProof);
        account.balance = FHE.add(account.balance, encryptedAmount);
        account.totalSpendLimit = FHE.add(account.totalSpendLimit, encryptedAmount);

        _allowAccountDecryptions(account, msg.sender);
        if (account.auditor != address(0)) {
            _allowAccountDecryptions(account, account.auditor);
        }

        emit TreasuryFunded(msg.sender);
    }

    /// @notice Pause or unpause the policy. While paused, requestPayment reverts.
    /// @dev Pause state is intentionally plaintext: it is owner-side metadata
    ///      and conveys no agent-spend information by itself.
    function pausePolicy(bool paused_) external {
        AgentAccount storage account = _accounts[msg.sender];
        if (!account.initialized) revert PolicyNotInitialized();
        account.paused = paused_;
        emit PolicyPaused(msg.sender, paused_);
    }

    /// @notice Owner toggles a merchant address into / out of the allowlist.
    function setMerchant(address merchant, bool allowed) external {
        if (!_accounts[msg.sender].initialized) revert PolicyNotInitialized();
        allowedMerchant[msg.sender][merchant] = allowed;
        emit MerchantUpdated(msg.sender, merchant, allowed);
    }

    /// @notice Owner grants an auditor selective decrypt rights.
    /// @dev Pass `address(0)` to revoke. The auditor inherits decrypt access
    ///      to balance / spend / lastPayment / merchant revenue ciphertexts
    ///      they are involved in via subsequent ACL grants.
    function setAuditor(address auditor) external {
        AgentAccount storage account = _accounts[msg.sender];
        if (!account.initialized) revert PolicyNotInitialized();

        account.auditor = auditor;
        if (auditor != address(0)) {
            _allowAccountDecryptions(account, auditor);
        }

        emit AuditorUpdated(msg.sender, auditor);
    }

    /// @notice Agent submits an encrypted payment request against the owner's policy.
    /// @dev Approval is computed homomorphically over the encrypted balance,
    ///      per-payment limit, and total spend cap. State is updated only if
    ///      the encrypted predicate evaluates to true; otherwise it is left
    ///      untouched, preserving balance privacy (silent failure pattern).
    function requestPayment(
        address owner,
        address merchant,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external onlyAgentOf(owner) {
        AgentAccount storage account = _accounts[owner];
        if (!account.initialized) revert PolicyNotInitialized();
        if (account.paused) revert PolicyIsPaused();
        if (!allowedMerchant[owner][merchant]) revert MerchantNotAllowed();

        euint64 encryptedAmount = FHE.fromExternal(amount, inputProof);
        _applyPayment(account, merchant, encryptedAmount);

        _allowAccountDecryptions(account, owner);
        if (account.auditor != address(0)) {
            _allowAccountDecryptions(account, account.auditor);
        }
        FHE.allowThis(_merchantRevenue[merchant]);
        FHE.allow(_merchantRevenue[merchant], merchant);
        if (account.auditor != address(0)) {
            FHE.allow(_merchantRevenue[merchant], account.auditor);
        }

        unchecked {
            paymentNonce[owner] += 1;
        }
        emit PaymentEvaluated(owner, account.agent, merchant, paymentNonce[owner]);
    }

    /// @dev Performs all homomorphic checks and state mutations for a payment.
    ///      Extracted to keep `requestPayment` below EVM stack-depth limits
    ///      without requiring `--via-ir` in environments like Remix.
    function _applyPayment(
        AgentAccount storage account,
        address merchant,
        euint64 encryptedAmount
    ) private {
        euint64 nextSpent = FHE.add(account.totalSpent, encryptedAmount);

        ebool hasBalance          = FHE.ge(account.balance, encryptedAmount);
        ebool underPerPaymentLimit = FHE.le(encryptedAmount, account.perPaymentLimit);
        ebool underTotalSpendLimit = FHE.le(nextSpent, account.totalSpendLimit);
        ebool approved = FHE.and(FHE.and(hasBalance, underPerPaymentLimit), underTotalSpendLimit);

        account.balance          = FHE.select(approved, FHE.sub(account.balance, encryptedAmount), account.balance);
        account.totalSpent       = FHE.select(approved, nextSpent, account.totalSpent);
        account.lastPaymentAmount  = FHE.select(approved, encryptedAmount, FHE.asEuint64(0));
        account.lastPaymentApproved = approved;

        euint64 currentRevenue = _merchantRevenueInitialized[merchant]
            ? _merchantRevenue[merchant]
            : FHE.asEuint64(0);
        _merchantRevenue[merchant] = FHE.select(
            approved,
            FHE.add(currentRevenue, encryptedAmount),
            currentRevenue
        );
        _merchantRevenueInitialized[merchant] = true;
    }

    // ---- View functions ------------------------------------------------------

    function getAgent(address owner)
        external
        view
        returns (address agent, address auditor, bool initialized, bool paused)
    {
        AgentAccount storage account = _accounts[owner];
        return (account.agent, account.auditor, account.initialized, account.paused);
    }

    function encryptedBalance(address owner) external view returns (euint64) {
        return _accounts[owner].balance;
    }

    function encryptedPerPaymentLimit(address owner) external view returns (euint64) {
        return _accounts[owner].perPaymentLimit;
    }

    function encryptedTotalSpendLimit(address owner) external view returns (euint64) {
        return _accounts[owner].totalSpendLimit;
    }

    function encryptedTotalSpent(address owner) external view returns (euint64) {
        return _accounts[owner].totalSpent;
    }

    function encryptedLastPaymentAmount(address owner) external view returns (euint64) {
        return _accounts[owner].lastPaymentAmount;
    }

    function encryptedLastPaymentApproved(address owner) external view returns (ebool) {
        return _accounts[owner].lastPaymentApproved;
    }

    function encryptedMerchantRevenue(address merchant) external view returns (euint64) {
        return _merchantRevenue[merchant];
    }

    // ---- Internal ------------------------------------------------------------

    function _writePolicy(
        address owner,
        address agent,
        externalEuint64 budget,
        externalEuint64 perPaymentLimit_,
        externalEuint64 totalSpendLimit_,
        bytes calldata inputProof
    ) private {
        euint64 encryptedBudget = FHE.fromExternal(budget, inputProof);
        euint64 encryptedPerTxLimit = FHE.fromExternal(perPaymentLimit_, inputProof);
        euint64 encryptedTotalLimit = FHE.fromExternal(totalSpendLimit_, inputProof);
        euint64 zero = FHE.asEuint64(0);

        AgentAccount storage account = _accounts[owner];
        account.owner = owner;
        account.agent = agent;
        account.balance = encryptedBudget;
        account.perPaymentLimit = encryptedPerTxLimit;
        account.totalSpendLimit = encryptedTotalLimit;
        account.totalSpent = zero;
        account.lastPaymentAmount = zero;
        account.lastPaymentApproved = FHE.asEbool(false);
        account.initialized = true;
        account.paused = false;

        _allowAccountDecryptions(account, owner);
        if (account.auditor != address(0)) {
            _allowAccountDecryptions(account, account.auditor);
        }
    }

    function _allowAccountDecryptions(AgentAccount storage account, address grantee) private {
        FHE.allowThis(account.balance);
        FHE.allowThis(account.perPaymentLimit);
        FHE.allowThis(account.totalSpendLimit);
        FHE.allowThis(account.totalSpent);
        FHE.allowThis(account.lastPaymentAmount);
        FHE.allowThis(account.lastPaymentApproved);

        FHE.allow(account.balance, grantee);
        FHE.allow(account.perPaymentLimit, grantee);
        FHE.allow(account.totalSpendLimit, grantee);
        FHE.allow(account.totalSpent, grantee);
        FHE.allow(account.lastPaymentAmount, grantee);
        FHE.allow(account.lastPaymentApproved, grantee);
    }
}
