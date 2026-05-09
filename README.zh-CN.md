<div align="center">

# CipherAgent Pay

**自主 AI Agent 资金库的加密策略层。**

基于 [Zama Protocol](https://www.zama.ai) FHEVM 构建。已部署于 Ethereum Sepolia。

[English](./README.md) · [中文](./README.zh-CN.md)

> _"隐私是有选择地把自己呈现给世界的力量。"_  
> — Eric Hughes，《赛博朋克宣言》，1993

</div>

---

## 概览

AI agent 正在开始花钱——买推理、数据、RPC、SaaS，将来还会互相付钱。今天最自然的做法是给 agent 一个热钱包加一个预算，但这样一来预算、动态余额、供应商列表全部暴露在链上。竞争对手能看到烧钱速度，供应商按上限报价，合规线根本签不下来。

**CipherAgent Pay** 是为这类新经济主体设计的"加密资金库策略层"。Owner 在浏览器里把预算、单笔上限、累计上限加密；agent 在密文规则下花钱，合约和任何观察者都看不到明文；审计员只能解开 owner 显式授权的字段。合约故意做成代币无关——它叠在任何支付轨道之上。

这是一种通过 ACL 选择性披露的隐私模型，不是匿名。

## 为什么是现在

机密链上金融已经从概念走入生产。Zama 生态里已经有机密钱包（[Bron](https://bron.org/)）、私密支付账户（[Raycash](https://www.raycash.xyz/)、[Zaïffer](https://www.zaiffer.org/)）、密封竞价拍卖（[deBerry's](https://deberrys.xyz/)）、隐私组合管理（[Orion Finance](https://www.orionfinance.ai/)）、以及[支持 ERC-7984 机密代币的浏览器](https://www.blog.blockscout.com/zama-confidential-tokens-block-explorer/)（Blockscout）。基础设施侧的合作方——OpenZeppelin（ERC-7984 标准）、Etherscan、Ledger、LayerZero、Fireblocks——让机构级落地具备可能。

钱包、代币、浏览器覆盖了**资产**那一层。CipherAgent Pay 填的是另一处空白：它们之上的**策略**层。一笔 confidential transfer 可以隐藏金额，但是授权这笔金额的规则——"这个 agent 单次最多 $50，每月最多 $5000，只能付给这几家供应商"——在大多数协议栈里仍然是明文的。CipherAgent Pay 把规则也加密了。

## 创新点

1. **加密策略作为一等原语**。Zama 生态目前在加密资产、余额和转账金额，CipherAgent Pay 加密的是**授权这些转账的规则本身**——预算、单笔上限、累计上限、动态累计、审批布尔、按商户营收。每一次授权都在密文上同态计算。
2. **策略层 silent failure**。每一次状态写入都用 `FHE.select(approved, …, untouched)`，超限尝试在链上留下的写入轨迹与审批通过完全一致，把明文 `require(...)` 会暴露的余额信息从结构上消除。
3. **Per-handle ACL + 自动角色识别**。同一个 UI 服务 owner、auditor、merchant。前端读链上元数据自动判断当前钱包扮演的角色，只拉对应密文 handle，不存在部分泄漏；未授权钱包得到一个干净的拒绝。
4. **代币无关的可组合性**。v0.1 不依赖任何代币——策略目前约束一个内部加密会计单位；v0.3 的 `IConfidentialToken` 适配器会让同一份合约直接治理 ERC-7984 cUSDC、原生 ETH 或任何未来的机密资产，不需要重新部署。
5. **加密资金库轮换**。`rotatePolicy` 让 owner 在每个预算周期（月度 / 季度）用新密文重置限额，同时**保留**商户白名单和 auditor 授权——真实的 CFO 工作流不会在周期边界上崩。
6. **按商户加密营收**。每个 vendor 只能解密自己的累计营收 handle；owner 看完整明细；任意两个 vendor 之间无法相互关联。

## 真实使用场景

我们围绕这四类用户做设计——都是受监管、有真实预算、能立刻把"加密支出策略"用起来的场景。

> **资产管理的 AI 研究台**。基金部署一群分析师 agent，订阅 Bloomberg、Kaiko、另类数据、推理 API。每个 agent 在统一策略下拥有 $5,000/月加密预算。竞争对手在链上看不到 burn rate，也看不到基金正在买哪些数据集。内部合规通过 auditor ACL 每月解密审计视图。

> **DAO 控制下的自主拨款 agent**。DAO 授权一个 "ops agent" 用加密季度上限给承包商和 infra 服务方付钱。库房规模、剩余资金、承包商列表全部对外不可见；DAO 选举的 auditor 按需解密总额；多签可以随时 pause + rotate 策略。

> **SOX / GDPR 合规企业的 AI agent fleet**。银行或医疗机构给每个内部 AI 助手设置加密单笔上限和累计上限。内部审计获得一等公民式的 auditor 解密权——满足监管期望的 controller-processor 模型。外部 vendor 只能解密自己的营收，无法跨 vendor 相关；链上没有明文预算，链下也不需要影子账本对账。

> **多租户 SaaS 给每个租户配 AI agent 预算**。SaaS 给每个客户的 AI 助手发一份独立加密策略。每个租户解密自己的余额和支出；SaaS 提供方作为 auditor 应对事件响应；任何租户都没法从链上推断别的租户的用量——多租户隐私由 FHE 强制，不靠"信任 SaaS"。

## CipherAgent Pay 在做什么

```text
              Owner（CFO / DAO / human-in-the-loop）
                            │
                            │  在浏览器中加密
                            ▼
                     CipherAgent Pay
            ┌──────────────────────────────────┐
            │  euint64 budget                  │
            │  euint64 perPaymentLimit         │
            │  euint64 totalSpendLimit         │
            │  euint64 totalSpent              │
            │  ebool   lastPaymentApproved     │
            │  ACL grants → owner / auditor /  │
            │               merchant           │
            └──────────────────────────────────┘
                            │
                            │  同态评估
                            ▼
                  通过 / 拒绝 → 支付轨道
                  （今天原生 ETH，未来 ERC-7984）
                            │
                            ▼
                       Zama FHEVM
```

Owner 一笔交易把加密策略发布到链上。每次 agent 支付，合约同态计算 `余额 ≥ 金额` ∧ `金额 ≤ 单笔上限` ∧ `已花费 + 金额 ≤ 累计上限`，全程在密文上完成。状态只在加密结果为真时更新；否则链上的写入轨迹和审批通过完全一样，余额隐私不受影响。

## 哪些数据被加密

| 字段                       | 类型      | ACL 授权后可见者                              |
| -------------------------- | --------- | --------------------------------------------- |
| 初始预算                   | `euint64` | Owner、可选 Auditor                           |
| 单笔限额                   | `euint64` | Owner、可选 Auditor                           |
| 累计支出限额               | `euint64` | Owner、可选 Auditor                           |
| 已花费总额（动态累计）     | `euint64` | Owner、可选 Auditor                           |
| 上一笔支付金额             | `euint64` | Owner、可选 Auditor                           |
| 上一笔支付审批结果         | `ebool`   | Owner、可选 Auditor                           |
| 商户营收（按商户分桶）     | `euint64` | 商户本人、Owner、可选 Auditor                 |
| 商户白名单                 | `bool`    | 公开（按设计的策略门槛）                      |
| 暂停开关                   | `bool`    | 公开（owner 控制的元数据）                    |
| Owner / agent / auditor    | `address` | 公开                                          |

每次状态写入 Zama 都会返回新的密文 handle，合约用 `FHE.allow(handle, addr)` 显式授权。商户永远拿不到 owner 的总余额，也拿不到其他商户的营收。

## 同态评估的核心 Solidity

```solidity
ebool hasBalance         = FHE.ge(account.balance, encryptedAmount);
ebool underPerPaymentCap = FHE.le(encryptedAmount, account.perPaymentLimit);
ebool underTotalCap      = FHE.le(nextSpent, account.totalSpendLimit);
ebool approved           = FHE.and(FHE.and(hasBalance, underPerPaymentCap), underTotalCap);

account.balance              = FHE.select(approved, FHE.sub(account.balance, encryptedAmount), account.balance);
account.totalSpent           = FHE.select(approved, nextSpent, account.totalSpent);
account.lastPaymentAmount    = FHE.select(approved, encryptedAmount, FHE.asEuint64(0));
account.lastPaymentApproved  = approved;
```

整个流程**零明文暴露**。"silent failure" 模式——每个槽位都用 `FHE.select(approved, …, untouched)`——意味着超限尝试在链上留下的写入形状与审批通过一模一样，只有 ACL 授权方能解读结果。

## 仓库结构

```text
contracts/CipherAgentPay.sol            策略层（约 330 行，单合约）
test/CipherAgentPay.ts                  8 个 hardhat 测试 · FHEVM mock 运行时
scripts/deploy.ts                       Sepolia 部署
frontend/                               React 19 + Vite 多页产品
├── src/main.tsx                        React Router 路由
├── src/App.tsx                         全局 layout（Nav + Outlet + Footer）
├── src/components/Nav.tsx              顶部导航
├── src/components/Footer.tsx           页脚
├── src/pages/Landing.tsx               官网首页（hero / why / how / cases / dev CTA）
├── src/pages/Studio.tsx                控制台仪表盘（角色 tab：owner / agent / disclosure）
├── src/pages/Explorer.tsx              链上活动浏览器（queryFilter on Sepolia）
├── src/pages/Developers.tsx            SDK 文档（左侧 sticky 导航）
├── src/lib/cipher-agent-client.ts      可复用 TypeScript SDK
├── src/cipherAgentPayAbi.ts            强类型 ABI 子集
└── src/styles.css                      编辑式深色主题 · Instrument Serif 字体
examples/agentkit-spend-agent.ts        Headless Node 示例 agent
hardhat.config.ts                       viaIR + Cancun EVM
vercel.json                             SPA 部署配置 + COOP/COEP headers
```

整个项目就这些。

## 合约接口

`contracts/CipherAgentPay.sol`（Solidity 0.8.24，`viaIR`，Cancun EVM，自定义错误）。

| 函数                                                                                          | 调用者 | 作用                                                                                           |
| --------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `createAgent(agent, merchant, eBudget, ePerTx, eTotal, proof)`                                | Owner  | 初始化加密策略，每个 owner 仅一次。事件 `PolicyCreated`。                                      |
| `rotatePolicy(agent, eBudget, ePerTx, eTotal, proof)`                                         | Owner  | 重置密文限额，清零累计支出，保留商户白名单和 auditor。事件 `PolicyRotated`。                   |
| `fundAgent(eAmount, proof)`                                                                   | Owner  | 同步增加加密余额和累计支出限额。                                                               |
| `pausePolicy(bool)`                                                                           | Owner  | Owner 端 kill switch。暂停期间 `requestPayment` revert（`PolicyIsPaused`）。                    |
| `setMerchant(merchant, allowed)`                                                              | Owner  | 调整商户白名单（公开策略门槛）。                                                               |
| `setAuditor(auditor)`                                                                         | Owner  | 授予 / 撤销 auditor 的选择性解密权。                                                           |
| `requestPayment(owner, merchant, eAmount, proof)`                                             | Agent  | 提交加密支付。审批由 FHE 同态完成，状态仅在 `ebool` 为真时更新。                                |
| `getAgent(owner)` / `paymentNonce(owner)` / `allowedMerchant(owner, merchant)`                | 任意   | 给索引器和 UI 用的公开元数据。                                                                 |
| `encryptedBalance / PerPaymentLimit / TotalSpendLimit / TotalSpent / LastPaymentAmount / LastPaymentApproved / MerchantRevenue` | 任意 | 返回密文 handle，没有 ACL 授权拿不到明文。 |

自定义错误：`InvalidAgent`、`PolicyAlreadyInitialized`、`PolicyNotInitialized`、`MerchantNotAllowed`、`NotAgent`、`PolicyIsPaused`。

事件：`PolicyCreated`、`PolicyRotated`、`PolicyPaused`、`MerchantUpdated`、`AuditorUpdated`、`PaymentEvaluated`、`TreasuryFunded`，全部带 indexed 字段，subgraph 可直接订阅。

## 快速上手

需要 Node.js 20 LTS（Hardhat 2 不支持奇数版本号的 Node）。

```sh
git clone https://github.com/Qinsir7/CipherAgentPay && cd CipherAgentPay
npm install --legacy-peer-deps
npm run compile
npm test            # 8 个测试 · FHEVM mock · 约 600ms
```

针对已部署的合约本地跑 dApp：

```sh
VITE_CIPHER_AGENT_PAY_ADDRESS=0xYourSepoliaContract npm run frontend:dev
```

部署到 Sepolia（部署账户需要 Sepolia ETH）：

```sh
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
npm run deploy:sepolia
```

## 产品形态

前端是一个四页 React 应用：

| 路由 | 用途 |
| --- | --- |
| `/` | 官网首页——hero 动效 cipher mark、问题陈述、三步流程、四类目标用户、SDK 预览 |
| `/app` | Studio 控制台——KPI 概览 + 角色 tab（Owner / Agent / Disclosure），同一钱包切换视角 |
| `/explorer` | 链上活动浏览器——一键查询 Sepolia 上的事件（`PolicyCreated`、`PaymentEvaluated`、`PolicyRotated`、`PolicyPaused`、`MerchantUpdated`、`TreasuryFunded`）|
| `/developers` | SDK 文档——install、connect、set policy、fund、request payment、decrypt scoped view、indexed events |

Studio 里的 "Decrypt my view" 会读取链上元数据，自动判断当前钱包扮演的角色（owner / auditor / merchant / 多重身份），只拉对应密文 handle，构造 EIP-712 用户解密信封并签名，由 Zama relayer 解出明文。商户用同一 UI 连接钱包只能看到自己的营收；未授权钱包会得到一个干净的拒绝，绝不会出现部分泄漏。

Explorer 流式展示合约对外暴露的公开事件——这些事件本身不携带任何金额。同一份数据可以无缝接入 Datadog dashboard、The Graph subgraph 或 SOC 2 审计日志。

## 测试

```sh
npm test
```

每个断言都基于真实的 `userDecryptEuint` / `userDecryptEbool` 输出——证明 ACL 在每次状态变更上都被正确挂载，不是只证明函数能跑通。

| # | 场景                                                                |
| - | ------------------------------------------------------------------- |
| 1 | 通过审批的支付，按 ACL 把视图开放给 owner / auditor / merchant。    |
| 2 | 超限支付静默失败——加密余额纹丝不动。                                |
| 3 | 多笔连续支付，密文累计支出正确。                                    |
| 4 | 暂停状态下 agent 支付 revert，恢复后立即可用。                      |
| 5 | 不在白名单的商户被 `MerchantNotAllowed` 拒绝。                      |
| 6 | `rotatePolicy` 重置累计、保留商户和 auditor 状态。                  |
| 7 | `createAgent` 拒绝重复初始化（`PolicyAlreadyInitialized`）。        |
| 8 | `fundAgent` 同步抬升加密余额与累计支出限额。                        |

## 合规与安全

**合规姿态。** CipherAgent Pay 是**通过 ACL 选择性披露的隐私模型，不是匿名**——这是给机构用户的有意选择。

- 参与方地址（owner、agent、auditor、merchant）全部公开。对手方归属和 FATF 旅行规则的"非匿名交易"要求被尊重。
- Auditor 角色是 ACL 原语本身的一部分，不是后挂的。Owner 显式授权与撤销——对应监管期望的 GDPR controller / processor 模型。
- 按商户加密营收给每个 vendor 一个隐私保护的"我从这个 principal 这里赚了多少"视图，可用于 VAT / 销售税对账，且不暴露买家聚合数据。
- 所有状态变更都发出 indexed 事件（`PolicyCreated`、`PolicyRotated`、`PolicyPaused`、`PaymentEvaluated` 等），SOC 2 审计轨迹可以在链下重建，全程不需要解密任何金额。
- Owner 自己 pause 和 rotate 自己的策略，没有全局 pause、没有管理员后门。Sovereignty 留在 principal——这对集成方之间的信任边界很关键。

**信任假设。** Owner 自己控制策略。**没有管理员后门、没有升级 key、没有协议费用**，也没有全局紧急停止。v0.1 合约没有任何外部调用，重入面为零。所有 FHE 操作和 ACL 授权都过同一对 `_writePolicy` / `_allowAccountDecryptions` 辅助函数，create 与 rotate 路径不会在权限上分叉。

**保护对象。** 支付金额、余额、限额、累计、审批布尔、按商户营收。全部 `euint64` / `ebool`。明文只能被持有具体密文 handle `FHE.allow` 授权的地址读到。

**不保护对象。** 参与者地址（任何有意义的授权流程都需要）、交易存在性（事件驱动 UX）、商户白名单（公开的策略门槛）、暂停标志（owner 元数据）。这些是设计选择，不是疏忽。

**关键威胁缓解。**

- 被攻陷的 agent key 无法越过加密的单笔上限或累计上限；owner 可以随时 `pausePolicy` 并 `rotatePolicy`。
- 商户既看不到 owner 总余额，也看不到其他商户的营收。
- 跨网络的密文重放会被 Zama instance 配置在 proof 验证阶段拦下。
- Auditor 撤销（`setAuditor(0x0)`）只影响**未来**写入的 handle；如果担心历史 handle 仍可解，rotate 一次策略即可让历史 handle 成为孤儿。

完整的 ACL 授权矩阵被编码在 `_allowAccountDecryptions` 中——如果某项未在那里声明，对应 handle 对那一方不可读。

## 路线图

```
v0.1  ✓  加密策略层 · Sepolia · 8 个测试 · React demo  （本版本）
v0.2     单策略多 agent · 商户级加密上限 · The Graph subgraph
v0.3     ERC-7984 代币适配器 · settleEncrypted() · TypeScript SDK
v0.4     多链（Base、Arbitrum）· 企业级 CFO 控制台 · Gnosis Safe 友好
v1.0     主网 · 第三方审计 · 生产 SDK
```

明确不做的事：不做与 ERC-7984 重复的机密代币、不引入协议费用、不加可升级 proxy、不留全局管理员 key。每一个版本要在 mock 测试通过、Sepolia 链上 smoke 测试通过、文档同步更新之后才会打 tag。

## 许可证

仓库使用 [MIT](./LICENSE) ——可以商用、可以 fork、可以嵌入。Solidity 文件头保留 `BSD-3-Clause-Clear` SPDX 标识，因为它们继承自 Zama FHEVM 库，是 Zama 的合规要求。
