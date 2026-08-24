# AIwright Platform — PRD v0.2 amendment

> **Status:** Draft / normative amendment to PRD v0.1  
> **Date:** 2026-08-21  
> **Applies to:** `prd-v0.1.md`, `roadmap.md`, and all later protocol/design artifacts  
> **Reason:** Promote planning/design artifacts and security controls into the product architecture

## 1. Amendment decision

PRD v0.1 remains the baseline product definition. This amendment adds requirements that were previously implicit or limited to risk notes:

1. Planning, design, security, evaluation, and operational outputs are first-class governed artifacts.
2. Artifact authority and context eligibility are explicit product behavior.
3. Prompt injection is handled through layered authority, permission, execution, and egress controls—not a detector alone.
4. Tools, MCP servers, agents, and evaluators have distinct identities and scoped capabilities.
5. Security monitoring produces structured events, correlated warnings, containment, and incident state.
6. Model-visible context and external data flow are controlled and auditable.

Where this amendment conflicts with PRD v0.1, this amendment takes precedence.

## 2. Revised product loop

```text
intent
  -> task contract
  -> governed planning/design artifacts
  -> approved context snapshot
  -> model/agent execution
  -> policy and permission decisions
  -> tools/MCP/sandbox/egress
  -> implementation artifacts
  -> validation evidence
  -> outcome
  -> findings and security signals
  -> intervention
  -> later measured effect
```

## 3. Added goals

### G7. Govern planning and design artifacts

The platform must trace product requirements, UX/design specifications, architecture, security controls, evaluation plans, tests, and operational documents through immutable revisions, review, approval, context use, validation, and supersession.

### G8. Enforce agent authority outside the model

The platform must evaluate identity, task, resource, action, purpose, data class, effect, duration, taint, and approval requirements before consequential operations.

### G9. Detect and contain AI-specific security failures

The platform must emit structured security signals for prompt injection, goal hijack, sensitive-data egress, permission escalation, tool/MCP integrity changes, secret exposure, anomalous tool sequences, sandbox violations, and cross-boundary access.

### G10. Preserve security and artifact provenance in feedback

Security and workflow findings must identify the exact artifact, context snapshot, tool manifest, policy version, action, and evidence that produced the result.

## 4. Added domain entities

| Entity | Definition |
|---|---|
| `artifact_revision` | Immutable revision of a planning, context, implementation, evidence, or operational artifact |
| `artifact_relation` | Typed dependency such as `constrains`, `implements`, `validated_by`, `supersedes`, or `conflicts_with` |
| `artifact_authority` | Lifecycle and authority state controlling context eligibility and promotion |
| `instruction_layer` | System, project, skill, task, user, external, or tool-derived instruction source with precedence and authority |
| `context_source` | Message, artifact, retrieval result, attachment, memory, or tool output available to a run/turn |
| `context_snapshot` | Immutable manifest of the sources and artifact revisions assembled for one model/agent invocation |
| `taint_label` | Security/information-flow state inherited from untrusted, external, generated, or quarantined sources |
| `permission_grant` | Task-, action-, resource-, purpose-, effect-, and time-scoped capability |
| `policy_decision` | Versioned permit, deny, restrict, or approval decision made outside the model |
| `approval_request` | Human/security approval object generated from a deterministic action request |
| `tool_manifest` | Approved identity, schema, scopes, package/digest, endpoint, and data-flow record for a tool or MCP server |
| `security_signal` | Structured detection or control event with severity, confidence, policy, and evidence references |
| `security_incident` | Correlated investigation and containment object spanning events, actors, tools, artifacts, and actions |
| `data_flow` | Source, classification, transformation, destination, and policy record for content movement |

## 5. Artifact requirements

### FR-A01 Artifact registry

Register planning, design, security, evaluation, delivery, implementation, evidence, and operational artifacts with:

- type and class;
- immutable revision;
- source and content hash;
- owner and provenance;
- lifecycle/authority state;
- security classification and content mode;
- context eligibility;
- dependencies and conflicts;
- approvals and unresolved findings;
- effective, expiry, and supersession state.

### FR-A02 Artifact lifecycle and promotion

Support:

```text
captured -> draft -> review_requested -> reviewed -> approved -> canonical
```

and:

```text
quarantined | rejected | integrity_failed | superseded | deprecated | expired
```

Generated or externally imported artifacts cannot promote themselves. High-impact policies, permission matrices, provider rules, and security artifacts require managed approval.

### FR-A03 Artifact relationship graph

Provide typed traceability from:

```text
problem/PRD
  -> UX and architecture
  -> threat/control/evaluation/test design
  -> implementation
  -> evidence
  -> outcome
  -> release and operation
```

Detect missing dependencies, conflicting approved artifacts, stale revisions, and implementation/evidence drift.

### FR-A04 Context eligibility

Automatic context assembly may use only revisions that pass:

- project/task scope;
- authority and freshness;
- integrity;
- security classification/provider policy;
- prompt-injection/secret checks;
- conflict/dependency resolution;
- token/excerpt budget.

Every model invocation records the loaded artifact revisions and source boundaries.

### FR-A05 Gate evaluation

Product, protocol, implementation, pilot, hosted-service, and release gates evaluate artifact relationships and evidence. Folder or file presence alone does not satisfy a gate.

### FR-A06 Artifact access and export

Separate permissions for metadata read, content read, export, revision, review, approval, promotion, deprecation, context loading, and security override. Context loading is treated as a potential provider export.

## 6. Security-control requirements

### FR-S01 Hybrid authorization

Use RBAC for administrative roles and ABAC/capability grants for execution. Every consequential action is evaluated against:

- principal and delegation chain;
- task and approved plan;
- action and target resource;
- purpose and environment;
- data classification and taint;
- requested effect and affected-resource count;
- risk tier;
- expiry and revocation state;
- required approval mode.

### FR-S02 Action-risk policy

Support R0–R5 action tiers:

- R0/R1 read and bounded low-risk analysis;
- R2 confidential-data access;
- R3 reversible local/project write;
- R4 external, destructive, publish, merge, deploy, send, delete, or access-change action;
- R5 admin, credential, security-policy, financial, or other privileged action.

R4 requires a deterministic transaction summary and hard approval. R5 is default-deny or routed through a separate trusted workflow/dual control.

### FR-S03 Prompt-injection and taint controls

- Label source provenance, trust, classification, and instruction authority.
- Separate instructions from external/tool data.
- Detect direct, indirect, obfuscated, tool, artifact, RAG, memory, and evaluator injection signals.
- Propagate taint through summaries, artifacts, context packs, and child-agent handoffs.
- Bind actions to task intent and approved plan.
- Enter restricted mode on material suspicion.
- Never allow the same model to self-certify that taint is cleared.

### FR-S04 Tool and MCP gateway

Before invocation:

- verify tool/server approved manifest and observed revision;
- validate actor, task, action, resource, scope, and arguments;
- enforce risk/approval policy;
- enforce rate/effect limits;
- apply sandbox and egress policy.

Material manifest, schema, digest, endpoint, or scope changes quarantine privileged use pending review.

### FR-S05 Credential and token controls

- Credentials remain outside normal prompts, memory, traces, and tool output.
- Use opaque references and a secret broker.
- Use short-lived, resource/audience-bound tokens.
- Forbid token passthrough.
- Use separate downstream credentials.
- Support revocation/rotation and access audit.

### FR-S06 Safe output and execution

- Treat model/tool output as untrusted.
- Use typed schemas and strict validation.
- Parameterize SQL/API operations.
- Canonicalize paths and prevent traversal/symlink escape.
- Sanitize Markdown/HTML/URLs.
- Block direct free-form output execution.
- Use sandbox, time, process, filesystem, and network constraints.

### FR-S07 Data classification and egress

Support C0–C4 data classes and enforce provider/domain/export policies at:

- context assembly;
- model invocation;
- tool/MCP calls;
- web/network requests;
- generated/rendered output;
- logs, alerts, traces, and support bundles;
- evaluator and observability exports.

C4 secrets never enter model context. C2/C3 exports require explicit policy.

### FR-S08 Security event and alerting

Emit structured events for at least:

```text
security.prompt_injection.suspected
security.goal_hijack.suspected
security.secret.detected
security.egress.blocked
security.permission.escalation_requested
security.tool_sequence.anomalous
security.mcp_manifest.changed
security.token.audience_mismatch
security.artifact.integrity_failed
security.evaluator_injection.suspected
security.sandbox.violation
security.cross_tenant_access.denied
security.emergency_stop.activated
```

Events include scope, actor, task/run, severity, confidence, policy/rule version, evidence references, decision, and response actions without copying raw secret values.

### FR-S09 Correlation and warnings

Correlate multi-step behaviors such as:

```text
untrusted source
  -> broad sensitive read
  -> archive/encoding
  -> new external destination
```

or:

```text
MCP manifest change
  -> scope escalation
  -> child-agent delegation
  -> destructive action
```

P0/P1 signals block or contain. P2 signals may restrict and require approval. P3/P4 signals are audited and included in post-session/security review.

### FR-S10 Emergency stop and containment

Support out-of-band stop at turn, run, task, agent, tool/MCP, provider export, project, and tenant scopes. Containment can terminate processes, revoke grants/tokens, disable network/export, quarantine tools/artifacts, stop memory promotion, and create an incident record.

### FR-S11 Incident management

Support:

```text
suspected -> triaged -> contained -> investigated -> eradicated -> recovered -> monitored -> closed
```

Record evidence, actor, rationale, containment, credential/tool/artifact changes, outcome reclassification, residual risk, and regression fixture creation.

### FR-S12 Control failure behavior

Define whether each critical control:

- fails closed;
- permits restricted local/read-only operation;
- buffers locally;
- allows the host task to continue with incomplete telemetry;
- blocks privileged actions.

The platform must not silently fail open.

## 7. Added user journeys

### Journey D. Planning/design artifact handoff

1. User or agent creates a PRD, architecture, threat model, EVAL_PLAN, or test plan.
2. Platform registers revision, provenance, classification, and dependencies.
3. Generated/external content remains draft or untrusted.
4. Review resolves findings and grants authority.
5. Context assembler selects minimal eligible excerpts for a task.
6. Implementation and evidence link back to exact revisions.
7. Drift or conflict creates a finding before release/readiness promotion.

### Journey E. Prompt-injection containment

1. External/tool content is labeled untrusted and loaded as data.
2. Detection or behavioral correlation raises an injection/goal-hijack signal.
3. Run enters restricted mode.
4. Proposed privileged action is denied or requires a deterministic approval request.
5. Egress and secret access remain blocked.
6. User can inspect evidence and restart with a clean context.
7. Confirmed cases become red-team/evaluation fixtures after review.

### Journey F. Tool/MCP trust change

1. Tool manifest is approved and pinned.
2. Observed schema, description, digest, endpoint, or scope changes.
3. Platform quarantines privileged capability.
4. Owner reviews diff, vulnerability status, data destinations, and scopes.
5. Approval creates a new trusted revision or disables the integration.

### Journey G. Security incident

1. Correlation engine identifies active exfiltration, RCE, cross-tenant access, or privilege abuse.
2. Out-of-band containment stops execution and revokes grants.
3. Incident record references events and artifacts without broadcasting raw secrets.
4. Responders investigate under audited access.
5. Recovery uses clean context, rotated credentials, and revalidated artifacts/tools.
6. Outcome and affected guidance are reclassified.

## 8. Added product surfaces

### Local pilot

- artifact register/status/graph/context-preview;
- permission and action-risk preview;
- security event report;
- export preview;
- restricted-mode indicator;
- emergency stop;
- local data inventory/delete;
- tool/MCP manifest inspection where supported.

### Hosted platform

Add primary views:

```text
Artifacts    revisions, authority, lineage, context use, drift, security
Security     signals, policies, controls, incidents, alert health
Access       roles, grants, approvals, raw-content access, break-glass
Integrations tool/MCP identities, manifests, scopes, changes, vulnerabilities
Data flows   classification, providers, destinations, blocked/allowed egress
```

These views complement, not replace, `Tasks`, `Sessions`, `Findings`, `Evals`, `Playbooks`, `Policies`, and `Operations`.

## 9. Added metrics

### Security outcome metrics

- blocked confidential/secret egress attempts;
- unsupported R4/R5 action execution count, expected zero;
- permission escalation requests and dispositions;
- prompt-injection/goal-hijack finding precision;
- mean time to contain P0/P1 incidents;
- emergency-stop effectiveness;
- MCP/tool manifest changes quarantined before privileged use;
- secret exposure and rotation completion;
- artifact integrity/drift findings resolved before gates;
- cross-tenant authorization failures, expected fail-closed;
- security-control health and audit-gap rate.

### Guardrails

- alert dismissal and repeated-warning rate;
- raw sensitive content copied into alerts, expected zero;
- false blocks by task/action class;
- user confirmation fatigue;
- restricted-mode usage and clean-restart outcomes;
- raw-content privileged access frequency;
- incident evidence retention beyond policy;
- security monitoring used for individual productivity ranking, prohibited.

## 10. Revised pilot boundary

The local Codex pilot may operate on real repositories only after P0 controls are implemented and tested:

- artifact authority and context source labels;
- local private storage and deletion;
- secret exclusion before model/export;
- deterministic permissions for supported tools;
- action-risk policy;
- output/path/command validation;
- restricted mode;
- export preview/provider policy;
- emergency stop;
- local security events;
- prompt-injection, exfiltration, rendering, path, permission, and stop fixtures;
- explicit failure-mode policy.

Until then, testing is limited to sanitized fixtures and disposable repositories without live credentials.

## 11. Required documentation set

The implementation repository cannot begin real integration work until these governed artifacts exist:

1. Artifact manifest and relationship schemas.
2. Protocol glossary and context-provenance specification.
3. Evidence model.
4. Security architecture.
5. Threat model and abuse-case catalog.
6. Security-control matrix.
7. Permission/action-risk matrix.
8. Data-classification and provider/egress policy.
9. MCP/tool trust-record schema.
10. Security-event and alert-routing schema.
11. Failure-mode policy.
12. Incident-response plan.
13. Pilot EVAL_PLAN.
14. Test and red-team plans.
15. Codex fixture/mapping inventory.
16. Local data-handling design.

## 12. Revised implementation decision

The next phase is not a collector/dashboard build. It is a bounded design-and-fixture phase producing:

```text
artifact schemas
+ context/instruction provenance
+ evidence model
+ permission/control matrices
+ security event schema
+ threat/abuse cases
+ red-team fixtures
+ failure-mode policy
```

Implementation may begin only after these artifacts are reviewed under the artifact lifecycle and the local-pilot P0 control set is testable.
