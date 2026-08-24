# AIwright Platform — M1 implementation handoff

> **Status:** Draft / next-session execution guide  
> **Date:** 2026-08-24  
> **Boundary:** Sanitized fixtures only; no live repository credentials, external writes, or arbitrary network

## 1. Current state

The project has moved from product/security concept into an initial protocol contract.

Available:

- PRD and amendments;
- artifact architecture;
- security architecture and control matrix;
- Protocol v0.1 and amendment;
- 11 root/shared JSON Schema files;
- P0 Codex permission matrix;
- Threat Model v0.1;
- 54 abuse cases;
- P0 EVAL_PLAN and amendment;
- schema-catalog integrity validator in CI;
- M1 review round 1 and disposition.

Not available:

- standards-compliant schema example validation;
- executable action catalog/PDP;
- raw event spool implementation;
- Codex adapter fixtures;
- reducer;
- sandbox/egress/secret runtime;
- real independent reviewer receipts;
- report/UI/runtime product.

## 2. Required reading order

1. `README.md`
2. `protocol-v0.1.md`
3. `protocol-v0.1-amendment-1.md`
4. `schemas/README.md`
5. `p0-codex-permission-matrix.md`
6. `threat-model-v0.1.md`
7. `abuse-case-catalog.md`
8. `pilot-eval-plan-v0.1.md`
9. `pilot-eval-plan-v0.1-amendment-1.md`
10. `m1-review-round-1.md`

Security architecture and control matrix are referenced when a slice touches permission, context, tools, data, export, monitoring, or incident behavior.

## 3. Do not start with

- dashboard;
- hosted API;
- multi-tenant database;
- live Codex wrapper over personal/production repositories;
- real OAuth/MCP credentials;
- arbitrary web access;
- LLM judge receiving real content;
- automatic prompt rewriting;
- employee/user scoring.

## 4. Recommended code boundary

The RFC still recommends a separate private `aiwright-platform` repository after M1 acceptance. Until that decision, implementation may be prototyped only as isolated conformance scripts/fixtures that do not change the public `aiwright` package contract.

Suggested future package shape:

```text
packages/
  protocol/
  conformance/
  adapter-codex/
  privacy/
  raw-event-spool/
  reducer/
  policy/
  security-events/
  local-report/
fixtures/
  protocol/
  codex/
  security/
```

## 5. Next implementation slices

### Slice M1.1-A — full schema conformance

Outputs:

- standards-compliant JSON Schema validator setup;
- valid and invalid examples per root schema;
- canonicalization test vectors;
- `assertions.schema.json`;
- conformance CLI and report.

Validation:

- examples produce expected pass/fail;
- all local references resolve;
- unknown fields are rejected where normative;
- semantic limitations are listed rather than misrepresented as schema coverage.

Review:

- protocol lens;
- operations lens;
- focused security review for examples containing sensitive metadata.

### Slice M1.1-B — executable P0 action catalog

Outputs:

- `action-catalog.schema.json`;
- machine-readable `codex-local-fixture` actions;
- deterministic PDP interface;
- decision examples for allow, deny, restricted mode, confirmation, expiry, and control failure;
- request/decision/approval/grant hash binding.

Validation:

- every supported Codex action class maps to one normalized action or explicit unsupported state;
- unknown/compound effects fail closed;
- session approval cannot broaden resource/effect;
- absolute denies remain denies after approval.

Review:

- security/red-team;
- DX approval-summary review;
- protocol review.

### Slice M1.1-C — crash-safe raw event spool contract

Outputs:

- segment/checkpoint manifest schema;
- writer and recovery state machine;
- content-before-event publication rule;
- corruption/orphan handling;
- durability profiles;
- fault-injection test plan.

Validation:

- partial final record;
- middle corruption;
- crash between blob and event;
- crash between event and checkpoint;
- duplicate/replayed event;
- concurrent writer rejection;
- disk full/permission failure.

Review:

- operations/reliability;
- security/audit;
- protocol projection consistency.

### Slice M2-A — fixture skeleton

Outputs:

```text
fixtures/security/<case-id>/
  README.md
  input/
  expected/
  assertions.json
  privacy-inventory.json
```

Start with:

```text
AC-001 direct injection
AC-002 repository indirect injection
AC-007 symlink escape
AC-010 validator command amendment
AC-014 approval replay
AC-016 synthetic secret
AC-030 emergency-stop descendant cleanup
AC-049 policy-engine unavailable
```

No real secret, network, or production resource is used.

## 6. Slice artifact contract

Each slice produces or updates:

- design/spec artifact;
- implementation task plan;
- threat/control impact statement;
- test/fixture inventory;
- validation report;
- reviewer findings/dispositions;
- residual-risk record;
- next gate decision.

A code diff without these supporting artifacts does not satisfy the platform's own design principles.

## 7. Review process

```text
intake and source freeze
  -> main implementation draft
  -> read-only protocol reviewer
  -> read-only security reviewer when relevant
  -> operations/DX/evaluation checklists
  -> finding consolidation
  -> main integrator patch
  -> focused recheck
  -> residual-risk and gate decision
```

Constraints:

- maximum two rounds;
- reviewers do not write;
- exact source revision is preserved;
- critical unresolved finding blocks;
- alternative brainstorming is limited to three implementable choices;
- no claim of independent review unless separate reviewer execution receipts exist.

## 8. CI and GitHub Actions discipline

The account has limited Actions capacity. Apply:

- batch related files through one Git tree/commit;
- avoid one full run per documentation file;
- use PR concurrency cancellation;
- run schema preflight before `npm ci`;
- do local/zero-network checks before pushing when a checkout is available;
- rerun only failed jobs, not all jobs;
- record why a full test run is necessary.

Do not weaken required checks merely to save minutes.

## 9. Definition of M1 complete

M1 completes only when:

- full JSON Schema examples pass/fail correctly;
- canonicalization vectors pass;
- action catalog and authorization binding are executable;
- crash-safe spool design is fault tested;
- mandatory P0 assertion format is implemented;
- independent protocol/security review is complete or a restricted waiver exists;
- no critical finding remains;
- CI passes at the frozen milestone revision.

## 10. Next queue

Recommended order:

```text
1. assertions and example schemas
2. valid/invalid examples + standards validator
3. action catalog + PDP decision fixtures
4. approval transaction-summary UX examples
5. spool segment/checkpoint contract
6. first eight security fixture skeletons
7. M1 review round 2
8. repository split decision
```

The next turn should execute items 1–3 as one bounded batch, then run review round 2 before any adapter or runtime code.