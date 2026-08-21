# AIwright Platform RFC

> **Status:** Draft / product-boundary review  
> **Snapshot date:** 2026-08-21  
> **Working title:** AIwright Platform — AI Work Intelligence & Optimization Control Plane

## Decision summary

AIwright Platform is proposed as an **outcome-centric observability, evaluation, and guidance layer for human–AI work**.

It is not another chatbot wrapper, a generic APM dashboard, or an employee ranking system. Its job is to preserve the chain below and turn it into evidence-backed feedback:

```text
user intent
  -> task contract
  -> prompts and context
  -> model / tool / agent activity
  -> artifacts and validation evidence
  -> task outcome
  -> actionable guidance
  -> measured improvement
```

The long-term target is provider-, client-, and task-agnostic. The first product slice is deliberately narrower: **Codex CLI/SDK development tasks**. Starting with every chat product and every automation surface would make the event model broad before the product can define or validate an outcome.

## Recommended repository boundary

Keep the current `aiwright` repository focused on its local prompt intelligence, scoring, profile, recipe, and adapter responsibilities. Incubate the hosted/control-plane product in a separate repository after this RFC is accepted.

```text
aiwright                     local prompt/profile intelligence core and CLI
aiwright-platform            proposed capture, task graph, evaluation, guidance, API, UI
codex-workflow-skills        intake, review, EVAL_PLAN and closeout workflow layer
harness-kit                  agent configuration and policy deployment layer
stackforge-atlas             engineering contracts, evidence and recovery knowledge
TOM Dev Forge                autonomous development control-plane consumer/integration
```

The temporary location of this RFC inside `aiwright` is intentional. It lets the product boundary be reviewed without expanding the public CLI implementation prematurely.

## RFC documents

1. [PRD v0.1](./prd-v0.1.md) — problem, users, scope, requirements, metrics and policy.
2. [Benchmark](./benchmark.md) — adjacent open-source systems, reusable patterns and differentiation.
3. [Delivery roadmap](./roadmap.md) — gated phases, architecture direction, repository layout and validation plan.

## Proposed decision

Adopt the following working split:

- **AIwright Core:** understands and improves prompt/configuration assets locally.
- **AIwright Platform:** observes real work sessions, reconstructs task execution, evaluates outcomes, and delivers evidence-linked guidance.
- **Adapters:** translate Codex, OpenTelemetry, gateways, SDKs, or imported traces into a versioned AIwright event envelope.
- **Policies:** keep content collection opt-in, redact before export, and prohibit individual employee rankings as a default product behavior.

## Review gates

This RFC should not trigger implementation until the following decisions are accepted:

- task, run, session, turn, artifact, outcome, evaluation, and intervention boundaries;
- content-capture modes and retention rules;
- individual versus team visibility rules;
- MVP task class and outcome verification method;
- separate repository decision;
- event-envelope ownership and compatibility policy.

## Current recommendation

Proceed with a **local-first Codex pilot**, not a multi-tenant dashboard. The pilot must prove that AIwright can reconstruct a task, identify evidence-backed friction, and improve a later comparable task without creating noise or leaking content. Only then should the hosted team platform be built.
