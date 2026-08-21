# AIwright Platform — security control matrix

> **Status:** Draft / implementation-planning artifact  
> **Version:** 0.1  
> **Date:** 2026-08-21  
> **Purpose:** Map threats to enforceable controls, events, response actions, phases, owners, and tests

## 1. Usage

This matrix converts the security architecture into implementation obligations.

Each control must have:

- a stable control ID;
- an enforcement point outside the model;
- a policy or configuration owner;
- observable health state;
- structured security events;
- negative and positive tests;
- a phase gate;
- documented failure behavior.

A control is not implemented merely because a system prompt mentions it.

## 2. Control families

| Prefix | Family |
|---|---|
| `IAM` | Identity, delegation, authentication, and token handling |
| `AUTHZ` | Task-bound permissions, risk tiers, approval, and revocation |
| `ART` | Artifact provenance, authority, integrity, and promotion |
| `CTX` | Context source, instruction boundaries, taint, and snapshots |
| `PI` | Prompt-injection and goal-hijack controls |
| `TOOL` | Tool/MCP trust, schemas, invocation, and change control |
| `EXEC` | Sandbox, command/path/output safety, and resource limits |
| `DATA` | Classification, secrets, privacy, retention, and deletion |
| `EGR` | Provider/network/rendering/export and DLP controls |
| `EVAL` | Evaluator isolation, calibration, and output validation |
| `MON` | Security events, detection, correlation, alerting, and health |
| `IR` | Emergency stop, containment, incident handling, and recovery |
| `SUP` | Dependency, model, MCP, skill, prompt, dataset, and artifact supply chain |
| `GOV` | Anti-surveillance, privileged access, audit, and governance |

## 3. Core control catalog

| ID | Requirement | Enforcement point | Primary events | Default failure behavior | Phase | Verification |
|---|---|---|---|---|---|---|
| `IAM-001` | Every human/service/agent/evaluator/tool operation has an explicit actor identity | Identity broker, adapter | `identity.authenticated`, `identity.unknown` | Unknown actor cannot perform R2+ access or R3+ actions | P0/P2 | Missing/spoofed actor fixtures |
| `IAM-002` | Child-agent identity and grant are distinct and narrower than parent | Orchestrator, permission broker | `delegation.created`, `delegation.denied` | Delegation fails closed | P1 | Child scope escalation negative tests |
| `IAM-003` | Access tokens are short-lived and resource/audience-bound | Connector/MCP auth | `token.issued`, `token.audience_mismatch` | Reject request; revoke on replay suspicion | P1 | Audience, expiry, replay tests |
| `IAM-004` | Token passthrough is forbidden; downstream APIs use separate credentials | MCP/tool gateway | `token.passthrough.blocked` | Block integration call | P1 | Confused-deputy test |
| `IAM-005` | Local/public OAuth clients use PKCE and exact redirect validation | Auth client/server | `oauth.flow.failed` | Authorization fails closed | P1 | Interception/open-redirect tests |
| `AUTHZ-001` | Policy evaluates principal, task, action, resource, purpose, environment, data class, taint, effect, and expiry | PDP | `policy.decision` | R2+/R3+ fail closed if PDP unavailable | P0 | Decision-table conformance |
| `AUTHZ-002` | Grants are task-, resource-, action-, purpose-, time-, and effect-bound | Permission broker | `permission.granted`, `permission.denied` | No matching grant means deny | P0 | Cross-task/resource tests |
| `AUTHZ-003` | R4 actions require deterministic transaction summary and hard approval | Approval broker | `approval.requested`, `approval.granted`, `approval.denied` | Block until valid approval | P1 | Send/delete/merge/deploy tests |
| `AUTHZ-004` | R5 actions default deny or require separate trusted dual-control workflow | Approval broker | `privileged_action.denied`, `dual_approval.completed` | Deny | P1/P2 | Admin/credential/policy tests |
| `AUTHZ-005` | Grants can be revoked/expired and active calls observe revocation | Permission broker, tool gateway | `permission.revoked`, `permission.expired` | Stop new calls; terminate when policy requires | P0 | Mid-run revocation test |
| `AUTHZ-006` | Maximum affected-resource count and action rate are enforced | PDP/tool gateway | `effect_limit.exceeded` | Block/throttle | P0 | Bulk-write/send fixtures |
| `ART-001` | Every governed artifact has immutable revision, hash, owner, provenance, authority, and classification | Artifact registry | `artifact.registered`, `artifact.revision.created` | Unregistered artifact cannot become approved context/control | P0 | Manifest/schema tests |
| `ART-002` | Generated/external artifacts cannot promote themselves | Artifact registry/promotion PEP | `artifact.promotion.denied` | Remain draft/untrusted | P0 | Self-promotion tests |
| `ART-003` | Approved/canonical artifacts require review and unresolved-critical-finding check | Artifact registry | `artifact.approval.granted`, `artifact.approval.denied` | Block promotion | P0/P1 | Critical finding gate tests |
| `ART-004` | Hash/signature/source revision is checked before privileged context use | Context assembler | `artifact.integrity.failed` | Quarantine and exclude dependent context | P0 | Tampered artifact fixture |
| `ART-005` | Tool, policy, threat, test, and implementation drift creates findings | Artifact graph/evaluator | `artifact.drift.detected`, `artifact.conflict.detected` | Warn/block gate by severity | P0/P1 | Stale/conflict fixtures |
| `CTX-001` | System/project/skill/task/user/external/tool layers remain distinguishable | Context assembler | `context.snapshot.created` | Missing boundaries reduce eligibility/confidence | P0 | Snapshot structure tests |
| `CTX-002` | Every source carries provenance, authority, trust, classification, derivation, and model visibility | Context assembler | `context.source.attached` | Unknown source treated as untrusted | P0 | Unknown/internal/generated source tests |
| `CTX-003` | Context selection uses minimum eligible current excerpts | Context assembler | `context.source.selected`, `context.source.denied` | Exclude stale/conflicting/ineligible content | P0 | Eligibility/token budget tests |
| `CTX-004` | Context snapshots are immutable and reference exact artifact/source revisions | Context store | `context.snapshot.created` | Invocation blocked if required snapshot cannot be persisted locally | P0 | Replay/integrity tests |
| `CTX-005` | Compaction preserves security constraints, source refs, classification, and taint or records loss | Compaction adapter/reducer | `context.compacted`, `context.constraint_lost` | Restricted mode when critical constraints lost | P1 | Compaction-loss fixtures |
| `PI-001` | External/tool/generated content is data, not authority, unless reviewed/promoted | Context firewall | `instruction.authority.denied` | Ignore as instruction; retain as analyzable data | P0 | Indirect injection cases |
| `PI-002` | Injection detectors combine deterministic, classifier, provenance, and behavioral signals | Ingress/context/detection | `prompt_injection.suspected` | No safety claim on detector pass; suspicion triggers policy | P0 | Obfuscated/multilingual tests |
| `PI-003` | Taint propagates through summaries, artifacts, memory, child handoffs, and tool arguments | Context/artifact/reducer | `taint.propagated`, `taint.cleared` | Taint cannot be cleared by same model assertion | P0/P1 | Derived-content tests |
| `PI-004` | Proposed actions are bound to task intent and approved plan | PDP/task-goal checker | `goal_hijack.suspected` | Block R3+ on material deviation | P0 | Off-task command/send tests |
| `PI-005` | Suspicion can enter restricted mode with read-only/no-secret/no-R4+ policy | Orchestrator/PDP | `restricted_mode.entered`, `restricted_mode.exited` | Restrict rather than broad continue | P0 | Restricted-mode tests |
| `TOOL-001` | Tool/MCP identity, manifest, schemas, package/image digest, endpoint, scopes, and destinations are registered | Tool trust registry | `tool.manifest.registered` | Unregistered privileged tool denied | P1 | Unknown tool tests |
| `TOOL-002` | Material manifest/schema/digest/scope change quarantines privileged use | Tool gateway | `mcp_manifest.changed`, `tool.quarantined` | Deny until reapproval | P1 | Rug-pull fixture |
| `TOOL-003` | Privileged inputs use strict typed schema and reject unknown fields | Tool gateway | `tool.arguments.invalid` | Reject call | P0 | Schema/fuzz tests |
| `TOOL-004` | Tool selection and action risk are evaluated by effect, not tool name | PDP/tool gateway | `tool.action.classified` | Unknown effect is elevated/reviewed | P0 | Generic HTTP/shell effect tests |
| `TOOL-005` | Tool output is untrusted and classified before context/render/execution | Tool gateway/output PEP | `tool.output.classified`, `tool.output.blocked` | Sanitize/quarantine | P0 | Malicious output tests |
| `EXEC-001` | Free-form LLM output never directly reaches shell, SQL, HTML, templates, or path operations | Tool adapters/renderers | `unsafe_output_execution.blocked` | Block | P0 | Shell/SQL/XSS/path tests |
| `EXEC-002` | Paths are canonicalized and confined; traversal/symlink escape is blocked | Filesystem PEP | `filesystem.escape.blocked` | Block/terminate on repeated attempt | P0 | Traversal/symlink tests |
| `EXEC-003` | Execution uses task-specific filesystem/process/resource boundaries | Sandbox | `sandbox.started`, `sandbox.violation` | Terminate violating run | P0 | Namespace/resource tests |
| `EXEC-004` | Network is disabled by default and cloud/local metadata endpoints are blocked | Sandbox/egress | `network.request.denied`, `metadata_access.blocked` | Block | P0 | SSRF/metadata tests |
| `EXEC-005` | Tool/model loops and resource budgets are bounded outside the model | Orchestrator | `budget.exceeded`, `loop.detected` | Stop/throttle | P0 | Infinite retry/cost tests |
| `DATA-001` | Every content object receives C0–C4 classification or defaults conservatively | Ingress/artifact/context | `data.classified`, `data.classification.unknown` | Unknown treated as protected per policy | P0 | Classification fixtures |
| `DATA-002` | C4 secrets never enter normal model context, trace, memory, or alert | Ingress/context/secret broker | `secret.detected`, `secret.context.blocked` | Redact/block; rotate if exposed | P0 | Known/synthetic secret tests |
| `DATA-003` | Secret broker resolves opaque handles only inside execution boundary | Secret broker/tool gateway | `secret.accessed`, `secret.access.denied` | Fail closed | P1 | Handle misuse tests |
| `DATA-004` | Local data uses private paths, restrictive modes, inventory, TTL, and delete | Local store/CLI | `local_data.created`, `local_data.deleted` | Warn/block sensitive import if storage unsafe | P0 | Permission/cleanup tests |
| `DATA-005` | Retention/deletion propagates to blobs, indexes, summaries, datasets, and exports where controlled | Data lifecycle | `retention.executed`, `deletion.verified` | Mark failure visibly; retry/escalate | P2 | Deletion propagation tests |
| `EGR-001` | Model/provider export checks classification, content mode, provider policy, task, and destination | Context/model egress PEP | `model_export.allowed`, `model_export.blocked` | Protected export fails closed | P0 | Provider policy tests |
| `EGR-002` | Network/tool egress uses destination allowlist, SSRF controls, DLP, size/rate limits | Egress gateway | `egress.allowed`, `egress.blocked` | Block | P0/P1 | Domain/query/body tests |
| `EGR-003` | Generated Markdown/HTML cannot auto-fetch arbitrary remote resources | Renderer | `remote_render.blocked` | Block/proxy safely | P0 | Markdown image exfil tests |
| `EGR-004` | Logs, traces, alerts, support bundles, and observability exports follow classification policy | Exporters/alerting | `telemetry_export.blocked`, `alert.redacted` | Redact/block | P0/P2 | Alert/log leakage tests |
| `EGR-005` | Encoded, fragmented, high-entropy, or unusual-volume egress is correlated | Egress/correlation | `covert_egress.suspected` | Block/restrict/investigate | P1 | Base64/chunked transfer tests |
| `EVAL-001` | Evaluated content is isolated from judge rubric/instructions | Evaluator gateway | `evaluation.started`, `evaluator_injection.suspected` | Fail/quarantine case | P1 | Rubric injection tests |
| `EVAL-002` | Baseline judges have no tools/network and bounded payload/budget | Evaluator sandbox | `evaluation.policy.denied` | Fail closed or deterministic fallback | P1 | Tool/network attempt tests |
| `EVAL-003` | Judge output uses strict schema, versioned model/rubric, and human calibration | Evaluation engine | `evaluation.result`, `evaluation.invalid` | Reject invalid output | P1 | Malformed/bias/calibration tests |
| `EVAL-004` | Evaluator output cannot grant permission, promote artifacts, or solely determine outcome | PDP/artifact registry | `evaluation.authority.denied` | Deny | P1 | Authority escalation tests |
| `MON-001` | Security events use structured schema, rule/policy versions, severity, evidence refs, and no raw secrets | Security event pipeline | All `security.*` | Buffer locally if remote sink unavailable | P0 | Schema/redaction tests |
| `MON-002` | Multi-step attack behavior is correlated by task/run/actor/destination | Correlation engine | `tool_sequence.anomalous`, `incident.suspected` | Restrict/block by severity | P1 | Attack-chain fixtures |
| `MON-003` | Alerts are deduplicated, rate-limited, privacy-filtered, and routed by severity/ownership | Alert router | `alert.sent`, `alert.suppressed`, `alert.failed` | Containment remains even if delivery fails | P1/P2 | Fatigue/routing tests |
| `MON-004` | Control health, missing audit, disabled scanners, and export gaps are monitored | Control health service | `control.unhealthy`, `audit_gap.detected` | Privileged actions pause where required | P0/P2 | Dependency failure tests |
| `MON-005` | Security anomaly models cannot become employee productivity scores | Governance/reporting | `governance.policy.denied` | Block prohibited view/export | P2 | UI/API authorization tests |
| `IR-001` | Emergency stop is out-of-band and scoped to turn/run/task/agent/tool/project/tenant | Orchestrator/tool gateway/sandbox | `emergency_stop.activated` | Immediate containment | P0/P2 | Nested/long-running stop tests |
| `IR-002` | Containment revokes grants/tokens, stops processes/egress, and freezes memory/artifact promotion | Response orchestrator | `incident.contained` | Continue containment until explicit recovery | P0/P1 | Containment test |
| `IR-003` | Incident state and transitions preserve evidence, actor, rationale, and residual risk | Incident store | `incident.*` | No silent closure | P1/P2 | Workflow transition tests |
| `IR-004` | Recovery uses clean context, rotated credentials, revalidated artifacts/tools, and minimum permissions | Recovery runbook | `incident.recovery.started`, `incident.recovered` | Block full restoration until gates pass | P1 | Poisoned-state recovery drill |
| `SUP-001` | Code and AI assets are pinned, hashed, sourced, and reviewed | Build/artifact/tool registries | `supply_chain.asset.registered` | Unverified privileged asset denied | P1 | Unknown source tests |
| `SUP-002` | SBOM/AIBOM, vulnerability, EOL, signature, and provenance checks apply where practical | CI/release | `supply_chain.finding` | Block by severity | P1/P2 | Compromised dependency fixture |
| `SUP-003` | Unofficial leak/mirror artifacts and untrusted binaries are quarantined | Installer/artifact registry | `artifact.quarantined` | Deny execution/use | P1 | Mirror/package substitution tests |
| `GOV-001` | Raw-content access is separate, JIT/break-glass where required, and audited | API/UI/data access PEP | `content.accessed`, `break_glass.used` | Deny without purpose/authorization | P2 | Insider-access tests |
| `GOV-002` | Personal guidance is private by default; team views aggregate and suppress small cohorts | Reporting policy | `report.access.denied`, `cohort.suppressed` | Deny unsafe aggregation | P2 | Cohort/privacy tests |
| `GOV-003` | Audit/policy records are tamper-evident and administration is separated | Audit ledger | `audit.integrity.failed` | Freeze privileged workflows | P1/P2 | Tamper/gap tests |
| `GOV-004` | Security monitoring is prohibited from default employment ranking use | Product policy/API | `governance.policy.denied` | Deny feature/export | P2 | API/UI policy tests |

## 4. Default permission and action-risk matrix

This matrix is a baseline. Domain packs may tighten it but cannot silently lower risk.

| Operation | Example resource | Risk | Default local pilot | Managed requirement |
|---|---|---:|---|---|
| Read public docs/fixtures | public URL, fixture directory | R0 | Allow/audit | Allow |
| Read project metadata | file names, Git status, manifest metadata | R1 | Allow within task root | Project access |
| Read source code/internal docs | repository content | R1/R2 | Explicit project scope | Project + classification policy |
| Read raw prompts/traces | rollout bundle, content blob | R2 | Explicit command and warning | Separate audited content permission |
| Search web without login | approved domains | R1/R2 | Domain-limited | Egress policy |
| Use credentialed read connector | private Git/issue/docs | R2 | Disabled until P1 | Scoped OAuth, provider policy |
| Write patch/task branch | isolated worktree/branch | R3 | Allow only supported root/branch | Grant + effect limit |
| Generate draft document/issue | local file or unsubmitted draft | R3 | Allow and label draft | Grant; no automatic publish |
| Install dependency | lockfile/package environment | R3/R4 | Disabled or explicit approval | Source/provenance scan + approval |
| Run tests/build | sandbox | R3 | Allow bounded | Resource/network policy |
| Invoke arbitrary shell | sandbox/host | R4 | Disabled except structured supported commands | Hard approval or deny |
| Send email/chat/comment | external recipient | R4 | Disabled | Recipient/data preview + approval |
| Publish artifact/release | registry/site | R4 | Disabled | Approval, signing, scan, rollback |
| Merge protected branch | repository | R4 | Disabled | Human/CI gate |
| Deploy/modify production | cloud/service | R4/R5 | Disabled | Separate trusted workflow, step-up |
| Delete data/resource | repo/file/SaaS record | R4/R5 | Disabled | Reversible staging + approval/dual control |
| Change permissions/access | repository/cloud/data | R5 | Deny | Separate security workflow/dual control |
| Retrieve/rotate credentials | secret store | R5 | Deny normal agent context | Secret broker + trusted workflow |
| Financial/legal commitment | payment/order/contract | R5 | Deny | Separate system and dual control |

## 5. Threat-to-control mapping

| Threat | Primary controls | Key detection | Containment |
|---|---|---|---|
| Direct/indirect prompt injection | `CTX-001..005`, `PI-001..005`, `AUTHZ-*` | `prompt_injection.suspected`, `goal_hijack.suspected` | Restricted mode; block R3+ deviation |
| Sensitive information disclosure | `DATA-*`, `EGR-*`, `IAM-*` | `secret.detected`, `sensitive_egress.attempted` | Block, redact, rotate, incident |
| Excessive agency/tool misuse | `AUTHZ-*`, `TOOL-*`, `EXEC-*` | `permission.escalation_requested`, `tool_sequence.anomalous` | Revoke grant, stop tool/run |
| Improper output handling | `TOOL-005`, `EXEC-001..002`, `EGR-003` | `unsafe_output_execution.blocked` | Block/quarantine output |
| Artifact/RAG/memory poisoning | `ART-*`, `CTX-*`, `PI-003`, `DATA-*` | `artifact.poisoning.suspected`, `artifact.integrity.failed` | Quarantine and invalidate context |
| MCP/tool rug pull | `TOOL-001..002`, `SUP-*` | `mcp_manifest.changed` | Disable/quarantine/reapprove |
| Token theft/confused deputy | `IAM-003..005`, `AUTHZ-*` | `token.audience_mismatch`, `token.replay.suspected` | Revoke/rotate/block |
| Unexpected code execution/RCE | `EXEC-*`, `TOOL-*`, `EGR-*` | `sandbox.violation`, `unexpected_code_execution` | Kill, isolate, incident |
| Multi-agent privilege laundering | `IAM-002`, `AUTHZ-*`, `PI-003` | anomalous delegation chain | Revoke child/root grants |
| Evaluator injection/manipulation | `EVAL-*`, `ART-003` | `evaluator_injection.suspected` | Fail/quarantine; deterministic fallback |
| Cross-tenant/insider access | `AUTHZ-*`, `GOV-*`, `DATA-*` | `cross_tenant_access.denied`, access anomaly | Block, incident, access review |
| Supply-chain compromise | `SUP-*`, `ART-004`, `TOOL-002` | provenance/signature/vulnerability findings | Quarantine/rollback |
| DoS/cost/loop exhaustion | `AUTHZ-006`, `EXEC-005`, `MON-*` | `budget.exceeded`, `loop.detected` | Throttle/stop |
| Audit/monitoring bypass | `MON-004`, `GOV-003` | `audit_gap.detected`, `control.unhealthy` | Pause privileged actions |

## 6. Security event and alert matrix

| Event | Severity default | User notification | Security owner | Automatic action |
|---|---:|---|---|---|
| `security.prompt_injection.suspected` | P2; P1 when tied to R3+ | Yes, bounded evidence | P1/repeated P2 | Taint/restricted mode |
| `security.goal_hijack.suspected` | P1 for R3+ | Yes | Yes | Block action |
| `security.secret.detected` | P1; P0 if transmitted | Yes | Yes | Redact/block; rotate workflow |
| `security.egress.blocked` | P1 for C2+ | Yes | Yes | Terminate request |
| `security.permission.escalation_requested` | P2/R4; P1/R5 | Yes | R5 yes | Deny/step-up |
| `security.tool_sequence.anomalous` | P1/P0 | Yes if task-owned | Yes/page P0 | Pause/kill run |
| `security.mcp_manifest.changed` | P1 | Tool owner | Yes | Quarantine integration |
| `security.token.audience_mismatch` | P1 | Minimal | Yes | Reject/revoke |
| `security.artifact.integrity.failed` | P1 | Artifact owner | Yes | Quarantine dependencies |
| `security.evaluator_injection.suspected` | P2/P1 | Evaluation owner | P1 | Fail/quarantine evaluation |
| `security.sandbox.violation` | P0/P1 | Yes | Page | Terminate/isolate |
| `security.cross_tenant_access.denied` | P0 | Authorized incident notice | Page | Block/incident |
| `security.audit_gap.detected` | P1 | Operations owner | Yes | Pause privileged workflows |
| `security.emergency_stop.activated` | Context-dependent | Yes | P0/P1 yes | Kill/revoke/freeze |
| `security.control.unhealthy` | P2/P1 | Admin/operator | Yes | Apply declared failure mode |

Alerts must not contain raw secret values or unrestricted prompt/tool bodies. Raw evidence access is separate and audited.

## 7. Control failure matrix

| Dependency/control failure | Allowed behavior | Blocked behavior | Required signal |
|---|---|---|---|
| Collector/export unavailable | Host task may continue; local incomplete marker | Claiming complete telemetry | `collector.unavailable` |
| Raw local store unavailable | Read-only/no-capture task only if user chooses | Captured/evaluated result claim | `event_store.unavailable` |
| Artifact registry/integrity unavailable | Explicit user-supplied minimal context in restricted mode | Automatic artifact context; artifact promotion | `artifact_control.unavailable` |
| Injection classifier unavailable | Normal deterministic permissions remain; status unknown | Claiming injection-clean | `detector.unavailable` |
| PDP/permission broker unavailable | R0/R1 local read may continue if policy permits | R2+, R3+ | `policy_engine.unavailable` |
| Secret broker unavailable | Non-secret work | Any secret-dependent call | `secret_broker.unavailable` |
| Sandbox unavailable | Analysis/import/report only | Tool execution | `sandbox.unavailable` |
| Egress/DLP unavailable | Offline/local work | External provider/tool/network transmission | `egress_control.unavailable` |
| Audit sink unavailable | Bounded local durable spool | Privileged action if spool unavailable/full | `audit_sink.unavailable` |
| Alert delivery unavailable | Containment remains; retry summary | Relaxing containment | `alert_delivery.failed` |
| Emergency-stop mechanism unhealthy | Do not start action-capable run | Any R3+ long-running action | `emergency_stop.unhealthy` |

## 8. Phase gates

### P0 fixture/local gate

Must implement and pass:

- `ART-001..005`;
- `CTX-001..004`;
- `PI-001..005` for supported flows;
- `AUTHZ-001..002`, `AUTHZ-005..006`;
- `TOOL-003..005` for bounded tools;
- `EXEC-001..005`;
- `DATA-001..004`;
- `EGR-001..004`;
- `MON-001`, `MON-004`;
- `IR-001..002`;
- explicit control failure matrix.

### P1 credentialed integration gate

Adds:

- `IAM-002..005`;
- `AUTHZ-003..004`;
- `TOOL-001..002`;
- `DATA-003` production-grade broker;
- `EGR-005`;
- `EVAL-*`;
- `MON-002..003`;
- `IR-003..004`;
- `SUP-*`.

### P2 hosted/team gate

Adds:

- tenant/project isolation;
- enterprise identity and step-up;
- `DATA-005`;
- `GOV-*`;
- centralized alerting/incident management;
- KMS/key separation;
- cross-tenant and insider tests;
- cohort privacy controls.

## 9. Ownership template

Each control implementation must declare:

```yaml
control_id: AUTHZ-001
owner_role: security_architecture
implementation_owner: platform_policy_team
phase: P0
status: draft
policy_artifact: art_permission_policy_v01
enforcement_points:
  - cli_tool_gateway
  - hosted_tool_gateway
events:
  - policy.decision
failure_mode: fail_closed_for_r2_read_and_r3_plus
tests:
  - tests/authorization/cross-task-deny.json
  - tests/authorization/effect-limit.json
known_gaps: []
last_reviewed_at: null
```

## 10. Acceptance rule

A phase cannot exit while any required control is:

- undefined;
- owned only by the model prompt;
- missing a negative test;
- missing a failure mode;
- emitting unclassified/raw-secret alert data;
- bypassable by another supported adapter or tool path;
- dependent on an unreviewed artifact or tool manifest;
- reporting healthy without observable evidence.
