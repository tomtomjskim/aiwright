# AIwright Platform — M1 protocol and policy review round 1

> **Status:** Completed review round / M1 remains open  
> **Review date:** 2026-08-24  
> **Source snapshot:** `docs/aiwright-platform-prd-v0` at `00a4ac44045d70cad0e29f5824cb4a6f7ab91f23`  
> **Review target:** Protocol v0.1, JSON Schema catalog, P0 Codex permission matrix, threat model, abuse-case catalog, and P0 EVAL_PLAN

## 1. Review decision

**Decision: proceed with restrictions. M1 is not closed.**

The artifact set now has a coherent product/security direction and a machine-readable protocol baseline. The first review also found gaps that would have created false confidence if implementation started immediately:

- child-agent delegation and reducer projection provenance were described but not schema-bound;
- security-event naming rejected events required by the threat and permission documents;
- indexed event metadata could contain unbounded nested payloads;
- security previews and preview hashes could disclose restricted or guessable values;
- explicit task contracts could satisfy confirmation fields with null values;
- schema CI proved JSON/reference integrity but not complete JSON Schema semantics;
- the permission matrix is still prose rather than an executable action catalog;
- event-spool crash consistency and atomic recovery are not yet specified or tested;
- the current review was separated by reviewer lens but was not executed by independent reviewer agents.

The accepted critical/high findings were patched where a deterministic contract was already clear. Remaining findings are explicit M1.1 or M2 gates rather than hidden TODOs.

## 2. Review method and independence statement

Five reviewer lenses were applied in separate passes:

1. protocol/architecture;
2. security/red-team;
3. operations/reliability;
4. DX/product;
5. evaluation/governance.

The main integrator was the sole writer. In this execution environment, no independent subagent-dispatch interface was exposed. Therefore this round is a **separated-lens integrator review**, not independent reviewer evidence.

M1 closure requires either:

- one independent read-only protocol reviewer and one independent read-only security reviewer against a frozen source revision; or
- an explicit owner waiver recording that independence was not available and the residual risk is accepted for sanitized-fixture work only.

No review agent may write to the target branch. Reviewer findings are inputs; the main integrator owns disposition and patches.

## 3. Evidence reviewed

- current Codex app-server configuration and managed requirements;
- Codex approval policies and sandbox modes;
- Codex command/file approval decisions;
- Codex structured thread items for messages, plans, commands, files, MCP/dynamic tools, collaborative agents, web search, and compaction;
- AIwright Protocol v0.1 and companion schemas;
- P0 Codex permission/action-risk matrix;
- Threat Model v0.1 and Abuse Case Catalog v0.1;
- P0 Pilot EVAL_PLAN;
- security architecture, control matrix, and prior adversarial reviews;
- CI result for JSON parsing, `$id`, local `$ref`, existing tests, typecheck, distribution checks, and production dependency audit.

## 4. Finding summary

| ID | Lens | Severity | Finding | Disposition |
|---|---|---:|---|---|
| M1-R1-A01 | Architecture | Critical | Child-agent delegation had no machine-readable handoff, context/artifact scope, grant-subset, lifecycle, or revocation record | Accepted and fixed with `delegation-record.schema.json` |
| M1-R1-A02 | Architecture | High | Reducer output lacked a projection manifest tying output to source ranges, gaps, versions, and hashes | Accepted and fixed with `projection-manifest.schema.json` |
| M1-R1-A03 | Architecture | High | Canonicalization and hashing semantics were insufficiently explicit for deterministic replay | Accepted with amendment; JCS/raw-byte rules added as normative direction; implementation tests remain open |
| M1-R1-A04 | Architecture | Medium | Common scope requires `project_id`, which does not represent pre-project or tenant-only managed events | Deferred to managed-profile v0.2; local-core remains project-bound |
| M1-R1-A05 | Architecture | High | Event `payload.metadata` allowed unbounded nested structures and could become a content/logging bypass | Accepted and fixed with bounded scalar/array metadata; complex payloads use content references |
| M1-R1-A06 | Architecture | Medium | Explicit task contracts required confirmation fields but allowed null confirmation values | Accepted and fixed; explicit contracts now require concrete actor and timestamp |
| M1-R1-S01 | Security | High | Security-event prefix allowlist rejected valid events such as filesystem, model-export, telemetry-export, and instruction-authority blocks | Accepted and fixed with open namespaced event pattern plus versioned rule catalog |
| M1-R1-S02 | Security | High | C3/C4 and secret-detection events could retain preview text | Accepted and fixed; sensitive previews are null |
| M1-R1-S03 | Security | High | Sensitive preview hashes can permit dictionary/re-identification attacks | Accepted and fixed; C3/C4 or `secret_detected` previews and preview hashes are both null |
| M1-R1-S04 | Security | High | Approval receipts and grants are linked by IDs but do not yet require canonical request/decision hashes, leaving a semantic TOCTOU/replay gap | Accepted; deferred to authorization schema v0.1.1 and conformance fixtures before execution code |
| M1-R1-S05 | Security | Medium | Namespaced `extensions` remain structurally open and require byte/depth/runtime limits | Accepted with runtime gate; extensions are not indexed authority and cannot contain raw C4 values |
| M1-R1-S06 | Security | High | Within-scope write permission does not prove a generated diff is safe or task-correct | Accepted; authorization, artifact review, scoped tests, and outcome evidence remain separate gates |
| M1-R1-O01 | Operations | High | Append-only JSONL strategy lacked crash/partial-write, checkpoint, blob-before-event, and corruption-recovery rules | Accepted; normative amendment added, implementation and fault-injection tests remain open |
| M1-R1-O02 | Operations | High | Zero-dependency validator checks catalog integrity but is not a full JSON Schema 2020-12 evaluator | Accepted; M1 remains open until standards-compliant positive/negative validation runs in CI |
| M1-R1-O03 | Operations | Medium | Per-file GitHub commits caused repeated full CI runs and unnecessary Actions usage | Accepted and fixed with batched Git-tree commits, PR concurrency cancellation, schema-first fail-fast, and timeout |
| M1-R1-O04 | Operations | High | Projection gaps and unsupported source fields were not durable first-class records | Accepted and fixed in projection manifest |
| M1-R1-D01 | DX/Product | Medium | The document set is large and lacks one implementation reading path and slice boundary | Accepted and fixed with `m1-implementation-handoff.md` |
| M1-R1-D02 | DX/Product | High | P0 permission matrix is precise prose but not yet executable configuration | Accepted; machine-readable action catalog is the next M1.1 artifact |
| M1-R1-D03 | DX/Product | Medium | Approval transaction summaries lack screen/CLI examples and prompt-frequency budgets | Accepted; approval UX specification is a pre-runtime gate |
| M1-R1-E01 | Evaluation | High | A 70% correctness/actionability threshold is too weak for high-severity findings shown as authoritative guidance | Accepted; amended to 80% for non-security high-severity findings, with 100% mandatory security-fixture enforcement |
| M1-R1-E02 | Evaluation | High | A 10% benign false-block allowance is too permissive for core happy-path fixtures | Accepted; core benign scenarios require zero false blocks, expanded benign suite target is at most 5% after stabilization |
| M1-R1-E03 | Evaluation | Medium | “Independent reviewer lenses” wording overstated the current execution mode | Accepted and corrected through explicit independence statement and closure gate |
| M1-R1-G01 | Governance | High | Security/usage signals can be repurposed into employee performance scoring | Previously accepted and retained as API/product prohibition, not only UI guidance |

## 5. Patched contracts

### 5.1 Delegation

`delegation-record.schema.json` now records:

- delegator and child identities;
- task/run scope and handoff hash;
- allowed context and artifact revisions;
- parent and child grants;
- grant-subset policy result;
- lifecycle, expiry, close behavior, and revocation;
- result artifacts/events.

An active delegation requires a passed subset check. This schema does not replace the deterministic subset evaluator.

### 5.2 Projection provenance

`projection-manifest.schema.json` now records:

- source adapter/stream ranges and hashes;
- event counts, completeness, and gaps;
- schema, adapter, mapping, reducer, redaction, retention, policy, rule, and evaluator versions;
- deterministic input/output hashes;
- unsupported events/fields;
- output reference and superseded projection.

A polished report without a projection manifest is not a reproducible product result.

### 5.3 Security-event privacy

- Security event names use a general lowercase namespaced syntax.
- Detection rule ID/version remains the controlled taxonomy.
- C3/C4 or secret-tainted events cannot carry preview text or preview hashes.
- Security logs reference evidence; they do not duplicate the payload under investigation.

### 5.4 Indexed event metadata

Indexed metadata is restricted to bounded scalar values and bounded scalar arrays. Nested, large, or provider-specific data belongs in a content pointer with classification, placement, retention, and access policy.

## 6. Brainstormed alternatives and decisions

### 6.1 Policy engine

| Option | Benefit | Failure/cost | Decision |
|---|---|---|---|
| Custom TypeScript decision functions | Lowest P0 integration cost, typed tests, easy fixture debugging | Can grow into ad hoc policy language | Use only behind a stable PDP interface for P0 |
| OPA/Rego | Mature policy ecosystem and explainability | Runtime/deployment complexity; policy/data shape learning cost | Re-evaluate for hosted/P1 |
| Cedar | Strong authorization semantics and analyzability | Integration and ecosystem tradeoffs for tool-effect policies | Re-evaluate after executable action catalog |

**Decision:** Start with a versioned JSON action catalog plus deterministic PDP interface. Do not invent a general policy DSL during P0.

### 6.2 Security-event taxonomy

| Option | Decision |
|---|---|
| Closed enum in schema | Rejected: brittle across domain packs and already contradicted current documents |
| Open namespaced pattern plus rule catalog | Selected: syntax stable, semantics versioned by rule/control artifacts |
| Provider raw event names only | Rejected: loses cross-adapter product semantics |

### 6.3 Event metadata

| Option | Decision |
|---|---|
| Arbitrary nested JSON | Rejected for indexed envelope |
| Bounded scalar metadata plus content pointer | Selected |
| Store all source payload inline | Rejected for privacy, indexing, and migration reasons |

### 6.4 Schema validation

| Option | Decision |
|---|---|
| Custom reference validator only | Retained as fast integrity preflight, insufficient for M1 closure |
| Standards-compliant validator such as Ajv in implementation/conformance package | Selected next step |
| Runtime-only validation without CI examples | Rejected |

### 6.5 Raw event storage

| Option | Decision |
|---|---|
| Append-only segmented event spool plus SQLite projections | Selected for local pilot |
| SQLite as only source of truth | Rejected: harder to preserve/replay exact source observations |
| Distributed queue/analytics store | Rejected until measured volume requires it |

### 6.6 Review topology

| Option | Decision |
|---|---|
| One main agent self-reviews all work | Insufficient as closure evidence |
| Five unbounded agents with write access | Rejected: noisy, costly, conflicting, unsafe |
| Bounded read-only protocol/security reviewers plus deterministic operations/DX/eval checklists | Selected baseline |

## 7. Open blockers

### M1.1 blockers

1. Standards-compliant JSON Schema validation with valid and invalid examples.
2. Canonical JSON/hash test vectors.
3. Machine-readable P0 action catalog and policy-decision examples.
4. Approval receipt/request hash binding and TOCTOU/replay fixtures.
5. Crash-safe segmented spool specification and fault-injection cases.
6. `assertions.schema.json` and mandatory P0 fixture skeleton.
7. Approval CLI/UI transaction-summary examples and prompt-frequency budget.
8. At least one independent protocol review and one independent security review, or explicit sanitized-fixture waiver.

### M2 blockers

1. Actual source-event fixture corpus.
2. Expected normalized graph and projection manifests.
3. Mandatory abuse-case assertions.
4. Full-schema conformance report.
5. Privacy literal-leak tests.

## 8. Residual risks

- Shell/action effect classification remains the hardest P0 implementation boundary.
- JSON Schema cannot enforce grant subset, timestamp order, absolute deny, revision equivalence, or control dependency health by itself.
- Hashes provide integrity, not confidentiality or anonymity.
- A sandbox specification is not proof of isolation on every operating system.
- The model may generate malicious changes entirely within its allowed write scope; review and validation remain required.
- Review independence is not yet demonstrated.

## 9. Round-1 verdict

```text
Product boundary:        PASS WITH RESTRICTIONS
Protocol direction:      PASS WITH PATCHES
Schema catalog integrity:PASS
Full schema semantics:   NOT YET PROVEN
P0 permission direction:PASS, NOT EXECUTABLE YET
Security design:         PASS FOR SANITIZED FIXTURE DESIGN
Real repository:         BLOCKED
Credentials/network:     BLOCKED
M1 milestone:            OPEN
```

The next work should not be a dashboard or live Codex wrapper. It is M1.1 conformance: executable action catalog, standards-compliant schema examples, crash-safe spool contract, and fixture assertions.