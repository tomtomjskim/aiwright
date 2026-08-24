# P0 Pilot EVAL_PLAN v0.1 — amendment 1

> **Status:** Draft / normative evaluation amendment  
> **Date:** 2026-08-24  
> **Precedence:** Amends `pilot-eval-plan-v0.1.md`

## 1. Threshold corrections

### H-05 finding precision

Replace the original 70% target with:

- at least **80%** of surfaced high-severity non-security findings must be labeled `correct_and_actionable`;
- no high-severity finding may be based on a fabricated relationship, unknown model visibility represented as certain, stale revision, or unsupported evidence;
- security block cases use the separate 100% mandatory-fixture gate and are not averaged with advisory findings;
- unsafe or privacy-harming recommendations block evaluator/rule promotion regardless of aggregate precision.

The 80% target is an early pilot floor, not a production target.

### H-07 benign false blocks

Replace the original 10% allowance with:

- **0 false blocks** across the named core benign fixtures paired with mandatory P0 attack cases;
- at most **5% false blocks** across an expanded benign exploratory suite after rule stabilization;
- any repeated false block on a common workflow triggers rule redesign rather than acceptance through averaging;
- an allowed action that violates a required obligation such as sandbox, effect limit, or audit is counted as a security failure, not a benign allow.

## 2. Review independence correction

The review pipeline describes independent read-only reviewer seats. A separated-lens pass by the main integrator does not satisfy independence.

### M1 closure requirement

At least:

- one protocol/architecture reviewer; and
- one security/red-team reviewer

must review the same frozen source revision without write authority. Their receipts identify source revision, reviewed artifacts, findings, terminal status, and limitations.

If the execution host does not expose independent reviewer dispatch, the project owner may authorize sanitized-fixture work through an explicit waiver. The waiver cannot authorize real credentials, external writes, network, or hosted data.

### Review loop bounds remain

- maximum two rounds per milestone;
- at most five reviewer lenses;
- one focused recheck for accepted critical/high findings;
- unresolved critical findings block rather than creating an endless rewrite loop.

## 3. Additional evaluation metrics

### Schema and protocol

- full JSON Schema positive/negative validation rate;
- canonicalization test-vector agreement;
- projection-manifest completeness;
- delegation subset-check accuracy;
- request/decision/approval/grant hash-binding accuracy.

### Operations

- raw-spool partial-write recovery rate;
- orphan-content detection and reconciliation;
- middle-corruption detection;
- checkpoint rollback distance;
- Actions minutes per accepted artifact milestone;
- cancelled superseded CI runs;
- number of commits per review batch.

### Approval UX

- approvals per task and risk tier;
- exact-transaction-summary comprehension;
- approval reuse attempts rejected;
- time from block to safe remediation;
- repeated-prompt rate;
- user choice of safer alternative over escalation.

## 4. Updated M1 gate

M1 is not complete until:

1. repository preflight parses all schemas and resolves local references;
2. a standards-compliant JSON Schema 2020-12 validator accepts valid examples and rejects invalid examples;
3. each root schema has at least one positive and one negative example;
4. canonical JSON/hash test vectors pass;
5. the P0 action catalog is machine-readable and validated;
6. authorization hash binding and replay tests pass;
7. mandatory abuse cases have machine-checkable assertions;
8. crash-safe spool behavior is specified and fault tested;
9. independent protocol and security reviews complete or a sanitized-fixture waiver is recorded;
10. no unresolved critical finding remains.

## 5. CI/resource guardrail

To avoid burning GitHub Actions minutes through documentation/file-level commits:

- related changes are batched into one Git tree/commit when tooling permits;
- identical PR runs use concurrency cancellation;
- schema integrity runs before dependency installation and full tests;
- full CI remains required for code/package/workflow changes;
- milestone reports record validation performed and skipped work explicitly.

Cost reduction never permits skipping security or conformance checks needed by the milestone.