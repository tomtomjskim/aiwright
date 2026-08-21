# AIwright Platform RFC

> **Status:** Draft / product-boundary and security review  
> **Snapshot date:** 2026-08-21  
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

The long-term target is provider-, client-, and task-agnostic. The first product slice remains deliberately narrower: **local-first Codex CLI/SDK development tasks**. Starting with every chat product, automation surface, hosted dashboard, and privileged connector would produce a broad attack surface before the platform can validate its task, artifact, evidence, and authorization model.

## Current architecture decisions

1. **The primary unit is a validated task outcome**, not a prompt, trace, or one-number user score.
2. **Planning and design documents are governed runtime inputs.** PRDs, architecture, threat models, skills, permission matrices, EVAL_PLANs, and runbooks have revisions, provenance, authority, security classification, and context eligibility.
3. **Prompt-injection detection is not the security boundary.** Deterministic identity, task-bound permissions, tool/MCP gateways, sandboxing, output validation, egress controls, and emergency stop sit outside the model.
4. **Raw observations and derived interpretations remain separate.** Events can be replayed into new reducers and evaluators without rewriting evidence.
5. **Personal guidance is private by default.** Team views aggregate workflow/task-class problems and do not rank named employees.
6. **The hosted platform remains blocked** until the local pilot proves reconstruction, artifact/context traceability, security enforcement, useful feedback, and safe failure behavior.

## Recommended repository boundary

Keep the current `aiwright` repository focused on its local prompt intelligence, scoring, profile, recipe, and adapter responsibilities. Incubate the hosted/control-plane product in a separate repository after this RFC is accepted.

```text
aiwright                     local prompt/profile intelligence core and CLI
aiwright-platform            proposed capture, artifact/task graph, security, evaluation, API, UI
codex-workflow-skills        intake, review, EVAL_PLAN and closeout workflow layer
harness-kit                  agent configuration and policy deployment layer
stackforge-atlas             engineering contracts, evidence and recovery knowledge
TOM Dev Forge                autonomous development control-plane consumer/integration
```

The temporary location of this RFC inside `aiwright` is intentional. It allows the product, artifact, and security boundaries to be reviewed without expanding the public CLI implementation prematurely.

## Normative document set and precedence

Read in this order:

1. [PRD v0.1](./prd-v0.1.md) — baseline problem, users, scope, requirements, metrics, and policy.
2. [PRD v0.2 amendment](./prd-v0.2-amendment.md) — adds artifact governance, authorization, prompt-injection, egress, monitoring, and incident requirements. It takes precedence where it conflicts with v0.1.
3. [Planning/design artifact architecture](./artifact-architecture.md) — artifact taxonomy, manifest, lifecycle, authority, context eligibility, dependency graph, and readiness gates.
4. [Security architecture and control plane](./security-architecture.md) — trust zones, identity, permissions, Tool/MCP controls, injection/taint, secrets, egress, monitoring, alerts, containment, and security testing.
5. [Security control matrix](./security-control-matrix.md) — stable control IDs, enforcement points, permission/action risk, security events, failure modes, phase gates, and verification tests.
6. [Delivery roadmap](./roadmap.md) — evidence-gated phases, repository direction, local pilot, hosted-service gate, and backlog.
7. [Adjacent-system benchmark](./benchmark.md) — reusable patterns and product differentiation.
8. [Product adversarial review](./adversarial-review.md) — product/protocol/evaluation blockers.
9. [Security adversarial review](./security-adversarial-review.md) — security failure modes, accepted controls, open blockers, and phase priority.

The artifact, security, and control-matrix documents are not optional appendices. They amend the architecture and implementation gates.

## Planning/design artifact principle

An artifact becomes dangerous or useful when an agent can consume it. The platform therefore distinguishes:

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

For the platform direction, treat that illustration as **legacy vision copy, not an accepted requirement**. A later documentation/product decision should either remove it or replace it with:

- private, multidimensional personal guidance;
- evaluator confidence and evidence instead of one opaque score;
- aggregated workflow/task-class findings for team views;
- explicit policy and audited access for any individual-level sharing.

Do not preserve `AIQ` merely for backward conceptual compatibility if it weakens trust or encourages invalid employee comparisons.

## Review and implementation gates

This RFC must not trigger real-repository or credentialed implementation until the following artifacts are reviewed:

- protocol glossary, event envelope, and artifact manifest schemas;
- context/instruction provenance and model-visibility specification;
- evidence model;
- threat model and abuse-case catalog;
- security-control matrix;
- permission and action-risk matrix;
- data-classification and provider/egress policy;
- Tool/MCP trust-record schema;
- security-event and alert-routing schema;
- critical-control failure-mode policy;
- incident-response and emergency-stop plan;
- local data-handling design;
- pilot EVAL_PLAN, test plan, red-team plan, and fixture inventory.

Until the local-pilot P0 control set is testable, work is limited to sanitized fixtures and disposable repositories without live credentials.

## Current recommendation

Proceed with **artifact/protocol schemas, context and evidence models, permission/control matrices, threat/abuse cases, security events, failure-mode policy, and red-team fixtures**. Do not start with a dashboard or multi-tenant service.

The first vertical slice must prove all of the following:

- task and session reconstruction;
- exact planning/design artifact revision traceability;
- model-visible context versus runtime-only evidence separation;
- deterministic permissions for supported tools;
- secret exclusion and classification-aware export;
- restricted mode and out-of-band emergency stop;
- prompt-injection, tool misuse, output-handling, egress, and artifact-poisoning fixtures;
- evidence-linked findings without persistent alert noise;
- safe failure behavior when collectors or security controls are unavailable.
