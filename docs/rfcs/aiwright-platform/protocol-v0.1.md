# AIwright Platform — Protocol v0.1

> **Status:** Draft / normative design contract  
> **Version:** 0.1.0  
> **Date:** 2026-08-24  
> **Scope:** Task, run, session, context, artifact, evidence, authorization, security-event, and incident interoperability  
> **Companion schemas:** [`./schemas/`](./schemas/)

## 1. Decision

AIwright Platform uses a provider-neutral protocol whose primary object is a **task with an intended outcome and evidence**, not a model request or chat transcript.

Provider and client events are preserved as source observations and mapped into this protocol through versioned adapters. Derived task graphs, findings, evaluations, and reports remain reproducible from the original observations and the exact reducer/evaluator versions.

```text
source observation
  -> privacy and policy edge
  -> immutable event envelope
  -> deterministic normalization
  -> task/context/artifact/evidence graph
  -> evaluation and security findings
  -> intervention and outcome measurement
```

The protocol is deliberately smaller than the full product domain. Domain packs may add task taxonomies, artifact types, evidence validators, and evaluation rules, but they cannot weaken universal identity, provenance, authority, privacy, authorization, or audit semantics.

## 2. Normative language

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are normative.

- A protocol implementation **MUST** preserve unknown source events when retention policy permits.
- A reducer **MUST NOT** invent relationships or model visibility.
- A model-generated statement **MUST NOT** grant authority, permission, approval, or evidence status by itself.
- Content collection and export **MUST** follow the active privacy policy before leaving the local/project boundary.
- Privileged actions **MUST** be enforced by a policy point outside the model.

## 3. Design principles

1. **Raw observation and interpretation are separate.**
2. **Task scope can cross sessions, tools, models, and agents.**
3. **Session ownership and task ownership are not assumed to be identical.**
4. **Context provenance and model visibility are explicit.**
5. **Artifacts are immutable revisions with authority and lifecycle.**
6. **Evidence records scope, revision, validator, coverage, and independence.**
7. **Permissions are task-, action-, resource-, purpose-, effect-, environment-, and time-bound.**
8. **Security decisions and control health are observable.**
9. **Content is referenced separately from indexed metadata.**
10. **Schemas and mappings evolve independently.**

## 4. Protocol profiles

To avoid forcing the hosted architecture onto the local pilot, the protocol defines profiles.

### 4.1 `local-core`

Required for the Codex local pilot:

- project, actor, task, run, session, turn, span;
- context source and snapshot;
- artifact manifest and revision;
- evidence record;
- event envelope;
- authorization decision for governed actions;
- security event;
- local privacy mode and retention metadata.

Tenant and workspace identifiers MAY be null.

### 4.2 `managed-project`

Adds:

- tenant/workspace boundaries;
- service identities;
- managed export and provider policy;
- RBAC/ABAC decisions;
- centralized audit and incident records;
- retention/deletion workflows.

### 4.3 `managed-organization`

Adds:

- cohort aggregation policy;
- cross-project controls;
- privileged/raw-content access;
- break-glass and separation of duties;
- tenant-level containment and recovery.

Implementations MUST declare supported profile and schema versions.

## 5. Identity domains

Identifiers are opaque strings. Prefixes below are recommended for debugging, not authorization.

| Entity | Recommended prefix | Definition |
|---|---|---|
| Tenant | `ten_` | Security, billing, and legal boundary |
| Workspace | `wsp_` | Organizational grouping inside a tenant |
| Project | `prj_` | Repository, product, operational area, or personal work context |
| Actor | `act_` | Human, service, agent, evaluator, collector, connector, or tool identity |
| Task | `tsk_` | User-level intended outcome |
| Task association | `tas_` | Explicit task/session/run relationship with source and confidence |
| Run | `run_` | One attempt under a specific context/configuration |
| Session | `ses_` | Client conversation/thread boundary |
| Turn | `trn_` | One user/agent processing cycle |
| Span | `spn_` | Timed operation or causal activity |
| Event | `evt_` | Immutable observation |
| Context source | `ctxs_` | Context-bearing source or revision |
| Context snapshot | `ctx_` | Exact context configuration for invocation/turn |
| Artifact | `art_` | Logical governed work product |
| Artifact revision | `rev_` | Immutable artifact content revision |
| Evidence | `evd_` | Validation or outcome evidence |
| Evaluation | `eval_` | Versioned assessment |
| Finding | `fnd_` | Evidence-linked issue or strength |
| Intervention | `int_` | Suggested/applied change |
| Permission request | `preq_` | Request for one governed effect |
| Permission grant | `pgr_` | Bounded capability authorization |
| Policy decision | `pdec_` | Deterministic allow/deny/approval result |
| Approval | `apr_` | Human or separately trusted approval receipt |
| Security event | `sec_` | Structured security signal and response |
| Incident | `inc_` | Correlated security/privacy/control failure case |

IDs MUST be unique within the owning security boundary. Managed implementations SHOULD use non-sequential, non-guessable identifiers externally.

## 6. Time, ordering, and replay

### 6.1 Required timestamps

Every event records:

- `occurred_at`: source-reported event time when available;
- `observed_at`: time received by the AIwright collector;
- `ingested_at`: time accepted by the event store.

If source time is unavailable, `occurred_at` MAY equal `observed_at` and `time_quality` MUST indicate `collector_assigned`.

### 6.2 Ordering fields

Every envelope includes:

- `event_id`;
- `source_event_id` when provided;
- `source_sequence` when provided;
- `stream_id` identifying the source event stream;
- `parent_event_id` when directly known;
- `causation_id` and `correlation_id` when known.

Global clock order MUST NOT be assumed across adapters. Reducers use source sequence, causal links, and timestamps with recorded uncertainty.

### 6.3 Idempotency

The ingestion idempotency key is:

```text
source.adapter_instance_id
+ source.stream_id
+ source.source_event_id or source_sequence
```

When the source supplies neither event ID nor sequence, the adapter MUST create a deterministic fingerprint from canonicalized source metadata and payload hash, and mark `idempotency_quality=derived`.

### 6.4 Replay

Raw observations are append-only. A projection records:

```text
source event range/hash
adapter mapping version
protocol schema version
reducer name/version
policy/redaction version
projection build time
```

Reprocessing MUST create a new projection revision rather than silently rewriting historical interpretation.

## 7. Scope object

The common scope object supports partially known relationships.

```json
{
  "tenant_id": null,
  "workspace_id": null,
  "project_id": "prj_aiwright",
  "task_id": "tsk_protocol",
  "run_id": "run_01",
  "session_id": "ses_codex_01",
  "turn_id": "trn_03",
  "span_id": "spn_tool_04",
  "parent_span_id": "spn_model_03",
  "root_task_id": "tsk_protocol"
}
```

Unknown optional identifiers remain null or absent. They MUST NOT be replaced by fabricated IDs merely to satisfy graph completeness.

## 8. Actor and delegation model

### 8.1 Actor types

```text
human_user
human_reviewer
human_admin
service
collector
adapter
agent_root
agent_child
evaluator
policy_engine
connector
tool_service
```

An analytics identity, execution identity, and provider account MAY refer to the same human but MUST remain distinct identifiers with explicit links.

### 8.2 Delegation

A delegation edge records:

- delegator actor;
- delegate actor;
- task and run;
- purpose;
- allowed artifact/context scope;
- permission grant references;
- expiry;
- parent/child agent relationship;
- handoff artifact or event;
- revocation status.

Child permissions MUST be equal to or narrower than parent permissions. Peer agents cannot expand each other's grants.

## 9. Task contract

### 9.1 Contract states

| State | Meaning |
|---|---|
| `explicit` | User or upstream workflow supplied and confirmed |
| `provisional` | Inferred or generated and not yet confirmed |
| `missing` | No trustworthy task target is available |

Evaluation confidence MUST be reduced when the contract is provisional or missing.

### 9.2 Required task fields

```json
{
  "task_id": "tsk_auth_refactor",
  "contract_state": "explicit",
  "intent": "Refactor authentication middleware without public behavior changes",
  "task_type": "software_change",
  "task_subtype": "refactor",
  "expected_artifact_types": ["code_diff", "test_result", "review_summary"],
  "acceptance_criteria": [
    "existing authentication tests pass",
    "expired-session regression test exists",
    "public API remains unchanged"
  ],
  "risk_band": "medium",
  "privacy_mode": "full_content_local",
  "owner_actor_id": "act_tom",
  "source_artifact_refs": ["art_prd"],
  "revision": 1
}
```

Task changes create a new task revision and a `task.updated` event. Materially different intent SHOULD create `task.split` or a new task instead of overwriting history.

## 10. Task, run, and session association

Tasks and sessions are many-to-many. The association object records:

```json
{
  "association_id": "tas_01",
  "task_id": "tsk_auth_refactor",
  "session_id": "ses_codex_01",
  "run_id": "run_01",
  "relationship": "primary_execution",
  "source": "explicit_user_binding",
  "confidence": 1.0,
  "created_by_actor_id": "act_tom",
  "created_at": "2026-08-24T07:00:00Z"
}
```

Relationship values include:

```text
primary_execution
supporting_research
review
validation
incident_response
imported_history
inferred_related
```

An inferred association MUST identify the inference method and remain reviewable.

## 11. Context protocol

### 11.1 Context source

Each source records:

- source identity and type;
- immutable revision or content hash;
- origin and provenance;
- trust state;
- instruction authority;
- security classification;
- model visibility;
- derivation state;
- taint labels;
- lifecycle and expiry;
- content reference or metadata-only representation.

Suggested source types:

```text
system_instruction
developer_instruction
managed_policy
project_instruction
skill
prompt_fragment
task_contract
user_message
conversation_history
memory
retrieval_result
repository_file
artifact_excerpt
attachment
web_content
email_or_message
tool_description
tool_result
agent_handoff
compacted_summary
```

### 11.2 Trust and authority are separate

Trust values:

```text
trusted_control
reviewed_internal
working_internal
external_untrusted
generated_unreviewed
integrity_failed
quarantined
unknown
```

Authority values:

```text
control
project_constraint
task_instruction
user_instruction
data_only
none
```

An internal or signed source MAY still have `authority=data_only`. Signature proves origin/integrity, not correctness or instruction authority.

### 11.3 Model visibility

```text
visible
runtime_only
unknown
redacted_from_platform
not_sent
```

Runtime-observed content MUST NOT be marked `visible` unless the source adapter or trace provides evidence that the model-facing request included it.

### 11.4 Context snapshot

A snapshot is immutable and associated with a turn or model invocation. It contains exact source revision references, ordering/precedence, selected excerpts, token estimates, classification/taint aggregation, provider decision, and compaction lineage.

Critical security constraints lost during compaction create `context.constraint_lost` and SHOULD force restricted mode or block the affected privileged action.

## 12. Artifact protocol

The artifact manifest in `artifact-architecture.md` is represented by the companion schema.

Required properties:

- logical artifact ID and immutable revision ID;
- artifact type/class;
- source system, URI, source revision, and content hash;
- creator and generation provenance;
- owner, lifecycle, authority, reviews, approvals, and unresolved findings;
- classification, integrity requirement, content mode, trust, scan states, and provider eligibility;
- context eligibility and expiry;
- dependency and traceability relations.

### 12.1 Artifact relation types

```text
derived_from
supersedes
constrains
implements
references
conflicts_with
depends_on
validated_by
produces
blocks
supports
refutes
released_as
recovered_by
```

Cycles are permitted for descriptive relations such as `references`, but dependency/readiness evaluation MUST detect prohibited cycles for `depends_on`, `implements`, and release-gate relations.

### 12.2 Authority levels

```text
untrusted_external
captured_reference
generated_draft
working_draft
reviewed_reference
approved_control
canonical
superseded
quarantined
```

Generated or external artifacts MUST NOT promote themselves to `approved_control` or `canonical`.

## 13. Evidence protocol

Evidence is not a boolean. Each record includes:

```text
evidence_type
claim_type
claim_ref
evidence_source
evidence_scope
evidence_revision
evidence_time
validator_identity
validator_type
independence_level
coverage_statement
result
confidence
artifact_refs
event_refs
limitations
expiry
```

### 13.1 Evidence levels

| Level | Interpretation |
|---|---|
| `E0_CLAIM` | Agent or actor completion claim only |
| `E1_OPERATIONAL` | Exit/status evidence, possibly unrelated |
| `E2_SCOPED_AUTOMATED` | Relevant lint/type/test/schema/security check |
| `E3_INDEPENDENT` | Independent review, CI, external system, or user acceptance |
| `E4_FIELD_OUTCOME` | Production/field outcome over an appropriate window |

Outcome evaluation reports coverage and independence. It MUST NOT collapse all levels to a single `validated=true` field internally.

### 13.2 Revision binding

Evidence MUST identify the artifact/source revision it validates. A test run against commit A does not validate commit B unless the validator explicitly proves equivalence.

## 14. Authorization protocol

Authorization contains four distinct objects:

1. `permission_request` — proposed effect;
2. `policy_decision` — deterministic decision and obligations;
3. `approval_receipt` — human or separately trusted approval when required;
4. `permission_grant` — active bounded capability.

### 14.1 Permission request

A request includes:

```text
principal
delegated_by
task/run
requested action
resource
purpose
environment
data classification
taint
risk tier
important arguments
requested effect limits
external destinations
reversibility
requested duration
source event/tool
```

### 14.2 Policy decision

Decision results:

```text
allow
deny
require_user_confirmation
require_security_approval
require_dual_approval
restricted_mode
```

The decision records policy/rule versions, control-health dependencies, reason codes, obligations, and evidence references.

### 14.3 Permission grant

Every grant is:

- actor-bound;
- task/run-bound;
- action-bound;
- resource-bound;
- purpose-bound;
- environment-bound;
- time-bound;
- effect-limited;
- revocable;
- non-transitive by default.

Grant use creates an audit event. Revocation and expiry MUST be observed by new calls; active calls MUST be terminated when the policy marks the action revocation-sensitive.

### 14.4 Approval receipt

High-risk approval is a transaction receipt, not generic consent. It captures exact resource/effect, external recipient, data leaving the boundary, reversibility, duration, warnings, approver identity, authentication strength, and decision.

An approval does not bypass absolute policy denies.

## 15. Action-risk model

```text
R0 public/sanitized read
R1 internal scoped read
R2 protected/raw/confidential read
R3 reversible bounded write or execution
R4 consequential external/publish/merge/deploy/delete/access effect
R5 privileged security/credential/admin/financial effect
```

The adapter MAY suggest a risk tier, but the policy engine owns final classification based on actual effect.

## 16. Security-event protocol

Security events record:

- event type and severity;
- task/run/actor/resource/destination scope;
- detection rule and version;
- classification and taint;
- policy decision and enforcement point;
- redacted evidence references;
- response actions;
- correlation/incident IDs;
- control-health state;
- disposition and reviewer feedback.

Security logs MUST NOT copy raw secrets or unbounded prompt/tool bodies.

Severity:

```text
P0_CRITICAL
P1_HIGH
P2_MEDIUM
P3_LOW
P4_INFO
```

A detector pass MUST NOT be represented as proof that content is safe.

## 17. Incident protocol

An incident correlates security events, affected tasks/runs/actors/artifacts, containment actions, investigation evidence, recovery gates, notifications, residual risk, and post-incident fixtures.

Lifecycle:

```text
suspected
triaged
contained
investigated
eradicated
recovered
monitored
closed
```

Every transition records actor, timestamp, rationale, evidence, and required approvals. Closure MUST NOT be silent and MUST record residual risk.

## 18. Event envelope

The envelope contains indexed metadata and a typed payload.

```json
{
  "schema_version": "0.1.0",
  "event_id": "evt_01",
  "event_type": "tool.invocation.completed",
  "occurred_at": "2026-08-24T07:00:00Z",
  "observed_at": "2026-08-24T07:00:00.120Z",
  "ingested_at": "2026-08-24T07:00:00.180Z",
  "time_quality": "source_reported",
  "source": {
    "adapter": "codex-app-server-v2",
    "adapter_version": "0.1.0",
    "adapter_instance_id": "adapter_local_01",
    "client": "codex",
    "client_version": "provider-reported",
    "stream_id": "thread_123",
    "source_event_id": "item_456",
    "source_sequence": 44
  },
  "scope": {
    "tenant_id": null,
    "workspace_id": null,
    "project_id": "prj_aiwright",
    "task_id": "tsk_protocol",
    "run_id": "run_01",
    "session_id": "ses_01",
    "turn_id": "trn_03",
    "span_id": "spn_tool_04",
    "parent_span_id": "spn_model_03"
  },
  "actor": {
    "actor_id": "act_agent_root_01",
    "actor_type": "agent_root"
  },
  "privacy": {
    "content_mode": "redacted_content",
    "classification": "C1_INTERNAL",
    "taint": [],
    "redaction_policy_version": "redact-v1",
    "retention_policy_version": "retain-local-v1"
  },
  "payload": {
    "kind": "tool_invocation",
    "metadata": {},
    "content_ref": null,
    "content_hash": null
  },
  "integrity": {
    "payload_hash": "sha256:...",
    "batch_id": null,
    "signature": null
  }
}
```

## 19. Event families

### 19.1 Lifecycle

```text
project.registered
task.declared
task.updated
task.split
task.merged
task.completed
task.abandoned
run.started
run.completed
run.failed
session.started
session.ended
turn.started
turn.completed
turn.failed
```

### 19.2 Context and instructions

```text
instruction.layer.applied
instruction.authority.denied
instruction.layer.conflict_detected
context.source.attached
context.source.detached
context.source.selected
context.source.denied
context.snapshot.created
context.compacted
context.constraint_lost
taint.propagated
taint.cleared
```

### 19.3 Model, tool, and agent runtime

```text
model.invocation.started
model.invocation.completed
model.invocation.failed
tool.invocation.requested
tool.invocation.started
tool.invocation.completed
tool.invocation.failed
agent.delegation.created
agent.delegation.denied
agent.child.started
agent.child.completed
agent.child.stopped
```

### 19.4 Artifacts and evidence

```text
artifact.registered
artifact.revision.created
artifact.promotion.requested
artifact.promotion.granted
artifact.promotion.denied
artifact.integrity.failed
artifact.conflict.detected
artifact.drift.detected
validation.started
validation.completed
validation.failed
evidence.recorded
outcome.classified
```

### 19.5 Authorization and security

```text
permission.requested
policy.decision
approval.requested
approval.recorded
permission.granted
permission.denied
permission.revoked
permission.expired
security.signal.detected
security.action.blocked
restricted_mode.entered
restricted_mode.exited
emergency_stop.activated
incident.created
incident.transitioned
incident.closed
```

### 19.6 Evaluation and guidance

```text
evaluation.started
evaluation.result
evaluation.invalid
finding.created
finding.accepted
finding.dismissed
finding.corrected
intervention.suggested
intervention.applied
intervention.dismissed
intervention.effect_recorded
feedback.recorded
```

## 20. Content placement

Content is stored separately from searchable metadata by default.

### 20.1 Placement modes

```text
none
inline_redacted
local_blob
managed_blob
external_reference
hash_only
```

### 20.2 Requirements

- `metadata_only` events MUST use `none`, `hash_only`, or approved external references.
- C4 secrets MUST NOT use inline or normal content blobs.
- Managed blobs require tenant/project policy, encryption, retention, and audited access.
- External artifact references record source revision and integrity where possible.
- Alerts and security events reference evidence instead of copying payload bodies.

## 21. Compatibility and versioning

### 21.1 Independent versions

```text
protocol schema version
source adapter version
source-to-protocol mapping version
redaction policy version
retention policy version
reducer version
evaluator/rubric version
permission policy version
security rule version
```

### 21.2 Change rules

- Additive optional fields MAY be minor versions.
- New required fields, changed semantics, enum removals, or identifier meaning changes require a major version.
- Unknown event types and fields SHOULD be preserved when safe.
- Adapters MUST publish a source-version support matrix and unsupported-field list.
- A mapping change MUST be replay-tested against fixtures.

## 22. Codex adapter mapping baseline

The first adapter targets structured Codex events, not terminal scraping.

| Codex source concept | AIwright mapping |
|---|---|
| Thread | Session |
| Turn | Turn and run activity |
| UserMessage / HookPrompt | Message/context source with distinct authority |
| AgentMessage | Generated message/artifact reference |
| Plan | Task-plan artifact revision |
| Reasoning summary | Runtime summary reference; not hidden chain-of-thought |
| CommandExecution | Tool invocation with command/action metadata |
| FileChange | Artifact revision/change event |
| McpToolCall / DynamicToolCall | Tool invocation with tool trust record |
| CollabAgentToolCall / SubAgentActivity | Delegation and child-agent graph |
| WebSearch | Tool invocation and external-untrusted context |
| ContextCompaction | Compaction event and snapshot lineage |
| Approval decision | Approval receipt and policy/audit link |
| Sandbox/config layers | Run configuration and control-context artifact |

The adapter MUST preserve Codex source fields and versions separately from normalized actions. A Codex `read_only_hint` is advisory; the AIwright policy engine classifies actual effect.

## 23. Conformance requirements

Protocol v0.1 is implementable only when the fixture suite proves:

1. valid envelopes and manifests pass schemas;
2. malformed/unknown events are bounded and preserved where safe;
3. duplicate ingestion is idempotent;
4. out-of-order and partial streams remain explicitly incomplete;
5. context visibility is not inferred from runtime observation;
6. task/session many-to-many associations replay consistently;
7. evidence is revision-bound;
8. permission decisions fail closed for governed actions when control state is unavailable;
9. raw secrets do not enter standard events, alerts, or model context fixtures;
10. reducer output is deterministic for the same source, versions, and policy.

## 24. Open decisions for v0.2

- canonical binary/content-bundle format;
- signed event batches and local key management;
- W3C Trace Context mapping details;
- OpenTelemetry GenAI extension naming;
- task comparability schema;
- organization cohort/privacy schema;
- policy language and decision-engine implementation;
- cross-device local identity reconciliation;
- exact retention propagation contract for external systems.

## 25. Implementation gate

This protocol remains a design contract. Connecting a real credentialed repository is blocked until:

- companion schemas validate approved positive and negative fixtures;
- the exact P0 Codex permission matrix is accepted;
- the threat model and abuse cases cover the local pilot;
- local storage, secret handling, restricted mode, and emergency stop are testable;
- a pilot EVAL_PLAN defines false-positive, security, reconstruction, and usability acceptance criteria.
