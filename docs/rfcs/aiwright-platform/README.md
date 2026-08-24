# AIwright Platform RFC

> **Status:** Draft / M1 protocol, artifact, and security review  
> **Snapshot date:** 2026-08-24  
> **Working title:** AIwright Platform — AI Work Intelligence & Optimization Control Plane

## Decision summary

AIwright Platform is proposed as an **outcome-centric observability, evaluation, guidance, artifact-governance, and security-control layer for human–AI work**.

It is not another chatbot wrapper, a generic APM dashboard, or an employee ranking system. Its job is to preserve and control the chain below:

```text
user intent
  -> task contract
  -> governed planning/design artifacts
  -> instruction and context snapshot
  -> model / tool / agent activity
  -> permission and security decisions
  -> implementation artifacts and validation evidence
  -> task outcome
  -> actionable guidance
  -> measured improvement
```

The long-term target is provider-, client-, and task-agnostic. The first product slice remains deliberately narrower: **local-first Codex CLI/SDK development tasks using sanitized fixtures and disposable repositories**. Starting with every chat product, automation surface, hosted dashboard, network, credential, and privileged connector would produce a broad attack surface before the platform can validate its task, artifact, evidence, authorization, and failure model.

## Current architecture decisions

1. **The primary unit is a validated task outcome**, not a prompt, trace, or one-number user score.
2. **Planning and design documents are governed runtime inputs.** PRDs, architecture, threat models, skills, permission matrices, EVAL_PLANs, and runbooks have revisions, provenance, authority, security classification, and context eligibility.
3. **Prompt-injection detection is not the security boundary.** Deterministic identity, task-bound permissions, Tool/MCP gateways, sandboxing, output validation, egress controls, and emergency stop sit outside the model.
4. **Raw observations and derived interpretations remain separate.** Events are replayed into versioned projection manifests rather than silently rewritten.
5. **Delegation is explicit.** Child agents receive distinct identities, recorded handoffs, narrower grants, expiry, and revocation.
6. **Personal guidance is private by default.** Team views aggregate workflow/task-class problems and do not rank named employees.
7. **The hosted platform remains blocked** until the local pilot proves reconstruction, artifact/context traceability, security enforcement, useful feedback, and safe failure behavior.

## Recommended repository boundary

Keep the current `aiwright` repository focused on its local prompt intelligence, scoring, profile, recipe, and adapter responsibilities. Incubate the hosted/control-plane product in a separate repository after M1 acceptance.

```text
aiwright                     local prompt/profile intelligence core and CLI
aiwright-platform            proposed capture, artifact/task graph, security, evaluation, API, UI
codex-workflow-skills        intake, review, EVAL_PLAN and closeout workflow layer
harness-kit                  agent configuration and policy deployment layer
stackforge-atlas             engineering contracts, evidence and recovery knowledge
TOM Dev Forge                autonomous development control-plane consumer/integration
```

The temporary location of this RFC inside `aiwright` is intentional. It allows the product, artifact, protocol, and security boundaries to be reviewed without prematurely expanding the public CLI implementation.

## Normative document set and precedence

Read in this order:

1. [PRD v0.1](./prd-v0.1.md) — baseline problem, users, scope, requirements, metrics, and policy.
2. [PRD v0.2 amendment](./prd-v0.2-amendment.md) — artifact governance, authorization, prompt-injection, egress, monitoring, and incident requirements. It takes precedence where it conflicts with v0.1.
3. [Planning/design artifact architecture](./artifact-architecture.md) — taxonomy, manifest, lifecycle, authority, context eligibility, dependency graph, and readiness gates.
4. [Security architecture and control plane](./security-architecture.md) — trust zones, identity, permissions, Tool/MCP controls, injection/taint, secrets, egress, monitoring, alerts, containment, and testing.
5. [Security control matrix](./security-control-matrix.md) — stable control IDs, enforcement points, risk, failure modes, phase gates, and verification.
6. [Protocol v0.1](./protocol-v0.1.md) — provider-neutral task/context/artifact/evidence/authorization/event contract.
7. [Protocol v0.1 amendment 1](./protocol-v0.1-amendment-1.md) — delegation, projection provenance, hashing, bounded metadata, crash-safe spool, and validation corrections. It takes precedence over Protocol v0.1 where stated.
8. [JSON Schema catalog](./schemas/README.md) — machine-readable local-core contracts and integrity validation.
9. [P0 Codex permission matrix](./p0-codex-permission-matrix.md) — exact sanitized local-fixture action decisions and approval translation.
10. [Threat Model v0.1](./threat-model-v0.1.md) — trust boundaries, threats, attack trees, control dependencies, and residual risks.
11. [Abuse Case Catalog v0.1](./abuse-case-catalog.md) — 54 reproducible attack/control-failure cases and fixture contract.
12. [P0 Pilot EVAL_PLAN](./pilot-eval-plan-v0.1.md) and [amendment 1](./pilot-eval-plan-v0.1-amendment-1.md) — metrics, bounded review pipeline, corrected precision/false-block gates, and stop conditions.
13. [M1 review round 1](./m1-review-round-1.md) — reviewer-lens findings, patches, alternatives, open blockers, and decision.
14. [M1 implementation handoff](./m1-implementation-handoff.md) — next slices, artifact requirements, review process, and Actions discipline.
15. [Delivery roadmap](./roadmap.md) — evidence-gated phases, repository direction, local pilot, hosted gate, and backlog.
16. [Adjacent-system benchmark](./benchmark.md) — reusable patterns and product differentiation.
17. [Product adversarial review](./adversarial-review.md) and [security adversarial review](./security-adversarial-review.md) — earlier blockers and accepted controls.

The artifact, protocol, security, control, threat, permission, and evaluation documents are not optional appendices. They define implementation gates.

## Machine-readable M1 baseline

The schema catalog currently covers:

```text
common definitions
event envelope
task contract and task-session association
delegation record
artifact manifest
context snapshot
evidence record
authorization objects
security event
incident record
projection manifest
```

CI parses the catalog, verifies unique `$id` values, and resolves local `$ref` targets before package installation and the existing tests. This is catalog-integrity validation, not full JSON Schema semantic conformance.

## Planning/design artifact principle

An artifact becomes dangerous or useful when an agent can consume it. The platform distinguishes:

```text
untrusted_external
generated_draft
working_draft
reviewed_reference
approved_control
canonical
superseded / deprecated / quarantined
```

Only eligible current revisions may be loaded automatically. Generated or external artifacts cannot promote themselves, grant permission, or become durable memory without an explicit lifecycle decision.

## Security principle

The platform assumes some prompt injections, misleading content, or compromised tools will bypass detection.

```text
source provenance and classification
  -> instruction/data separation
  -> taint propagation
  -> task-goal binding
  -> policy and permission decision
  -> typed tool validation
  -> sandbox and egress enforcement
  -> monitoring and containment
```

No consequential path may go directly from model output to shell, SQL, HTML, file paths, network transmission, artifact promotion, permission change, send/publish/delete/merge/deploy, or credential use.

## Compatibility note: existing AIQ/team-dashboard concept

The current public README includes an illustrative team capability dashboard with named individual `AIQ` scores. That concept conflicts with this RFC's evidence-first and anti-surveillance policy if interpreted as a management ranking feature.

For the platform direction, treat that illustration as **legacy vision copy, not an accepted requirement**. Replace it later with private multidimensional guidance, evidence/confidence, aggregate workflow findings, and separately audited individual sharing.

## Current review state

```text
Product boundary:         accepted with restrictions
Artifact architecture:    draft normative baseline
Security architecture:    draft normative baseline
Protocol/schema catalog:  integrity-valid, semantic conformance pending
P0 permission policy:     precise prose, executable catalog pending
Threat/abuse cases:       documented, fixtures pending
Review round 1:           complete as separated-lens integrator review
Independent review:       pending
M1 milestone:             open
Real repository:          blocked
Credentials/network:      blocked
Hosted service:           blocked
```

## Review and implementation gates

Before real-repository or credentialed implementation:

- full JSON Schema positive/negative validation;
- canonicalization test vectors;
- executable P0 action catalog and deterministic PDP examples;
- authorization request/decision/approval/grant hash binding;
- crash-safe event spool and fault-injection tests;
- machine-checkable mandatory abuse-case assertions;
- approval transaction-summary UX and prompt-frequency controls;
- independent protocol and security review or explicit sanitized-fixture waiver;
- emergency-stop and degraded-control tests;
- no unresolved critical finding.

Until the local-pilot P0 control set is testable, work remains limited to sanitized fixtures and disposable repositories without live credentials.

## Current recommendation

Proceed with **M1.1 conformance**, not runtime integration:

```text
assertion/example schemas
  -> standards-compliant schema validation
  -> executable P0 action catalog
  -> authorization hash/replay fixtures
  -> crash-safe spool contract
  -> first mandatory security fixtures
  -> M1 review round 2
```

Do not start a dashboard, external connector, live-repository collector, arbitrary network path, or multi-tenant service.