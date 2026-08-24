# AIwright Platform — threat model v0.1

> **Status:** Draft / security gate  
> **Version:** 0.1  
> **Date:** 2026-08-24  
> **Primary scope:** `codex-local-fixture` P0 pilot  
> **Forward scope:** Credentialed project and hosted control-plane profiles

## 1. Executive decision

The highest-risk failure is not an obviously malicious prompt. It is a normal-looking workflow in which untrusted content gains instruction authority, the model requests a plausible permission, the user approves an ambiguous summary, and a tool reads or transmits more data than the task requires.

The threat model therefore assumes:

- prompt injection will sometimes evade detection;
- models and evaluators may follow malicious or conflicting instructions;
- users may approve risky actions under time pressure;
- internal artifacts, memory, tools, and package metadata may be poisoned;
- sandbox, policy, audit, and alerting dependencies may fail;
- data may leak through indirect channels such as logs, Markdown rendering, query strings, archives, or model evaluation;
- a benign agent with excessive permission can produce the same damage as a compromised agent.

The security objective is to preserve **intent, authority, data boundaries, and recoverability** even when model behavior is wrong.

## 2. Scope

### 2.1 Included in P0

- Codex structured event ingestion;
- user, hook, project, task, tool, and generated context;
- local disposable worktree execution;
- command and file-change authorization;
- read-only synthetic MCP fixture;
- read-only child-agent fixture;
- governed artifacts and draft memory;
- local event/blob storage;
- deterministic evaluation and security rules;
- restricted mode and emergency stop;
- local post-session report.

### 2.2 Explicitly excluded from P0

- live credentials or OAuth;
- production or personal repositories;
- external write-capable MCP/connectors;
- arbitrary internet access;
- Git push, PR, merge, deploy, publish, send, or remote delete;
- third-party LLM judge receiving real content;
- multi-tenant hosted service;
- browser/computer-use access;
- production secrets, customer data, or regulated records.

Attempting to introduce an excluded capability is a profile violation, not a routine permission request.

## 3. Method

This model combines:

- assets and trust-boundary analysis;
- STRIDE-style spoofing, tampering, repudiation, disclosure, denial, and privilege threats;
- LLM/agent-specific prompt injection, excessive agency, context poisoning, tool misuse, and evaluator manipulation;
- privacy threats including linkability, overcollection, secondary use, and employee surveillance;
- attack-chain and abuse-case analysis;
- control-failure analysis.

Risk labels are planning aids, not mathematical probabilities.

```text
Likelihood: Low / Medium / High
Impact:     Low / Medium / High / Critical
Priority:   P0 / P1 / P2 / P3
```

## 4. Protected assets

| Asset | Security property | Failure consequence |
|---|---|---|
| Task intent and acceptance criteria | Integrity, provenance | Goal hijack, false completion, unsafe action |
| Instruction layers and context snapshots | Authority, integrity, confidentiality | Injection, hidden conflict, sensitive disclosure |
| Human/agent/service identities | Authenticity, revocability | Spoofing, confused deputy, untraceable action |
| Permission requests, decisions, approvals, grants | Integrity, non-repudiation, least privilege | Privilege escalation, approval replay |
| Tool/MCP manifests and schemas | Integrity, provenance | Rug pull, hidden write effect, token abuse |
| Source code and implementation artifacts | Confidentiality, integrity | Exfiltration, sabotage, supply-chain compromise |
| Planning/security artifacts | Authority, lifecycle, integrity | Persistent poisoned policy or design |
| Memory and compacted summaries | Provenance, correction, expiry | Persistent injection and stale constraints |
| Evidence and evaluations | Revision binding, independence | Fabricated validation and false outcome |
| Secrets and connector tokens | Confidentiality, audience, expiry | Account compromise and lateral movement |
| Raw traces and content blobs | Confidentiality, retention | High-density leak of prompts, paths, source, credentials |
| Security events and audit ledger | Integrity, availability, minimization | Invisible abuse or secondary data leak |
| Sandbox and execution boundary | Isolation, availability | Host compromise and uncontrolled effects |
| Tenant/project boundaries | Isolation, purpose limitation | Cross-tenant disclosure and surveillance |
| Emergency stop and recovery state | Availability, integrity | Inability to contain active incident |

## 5. Actors and threat agents

### 5.1 Legitimate actors that may make mistakes

- user granting an overly broad approval;
- reviewer promoting an incomplete artifact;
- administrator enabling full-content capture or broad access;
- developer misclassifying a tool as read-only;
- operator restoring a poisoned context after an incident.

### 5.2 Malicious or compromised actors

- external content author attempting indirect prompt injection;
- malicious user abusing allowed tools;
- compromised repository contributor;
- compromised package, skill, model, MCP server, or connector;
- malicious or compromised employee/administrator;
- attacker with local filesystem access;
- attacker stealing/replaying a connector token;
- external service returning malicious tool output;
- poisoned evaluator case or benchmark dataset.

### 5.3 Non-human failure sources

- model hallucination or instruction-following error;
- parser/classifier false negative;
- sandbox escape or configuration regression;
- control-plane outage;
- event loss, reordering, or clock skew;
- compaction/summarization loss;
- provider/model/version drift;
- storage corruption or incomplete deletion.

## 6. Trust zones

```text
Z0 Human/UI
Z1 External and mixed-trust content
Z2 Context assembly and model inference
Z3 Identity, policy, permission, approval, artifact control plane
Z4 Tool/MCP gateway, sandbox, filesystem, egress boundary
Z5 Event, metadata, content, audit, incident data plane
Z6 Model providers and external services
```

### 6.1 Boundary rules

- Crossing Z1 → Z2 does not grant instruction authority.
- Crossing Z2 → Z4 requires typed action, policy decision, and grant.
- Crossing Z4/Z5 → Z6 requires destination and data policy.
- Z2 model output is untrusted input to Z3/Z4.
- Z5 security logs cannot become an unfiltered copy of Z1/Z2 content.
- Z3 decisions remain effective if the model disagrees or ignores a stop instruction.

## 7. Primary data flows

### DF-01 User/task intake

```text
User/upstream task
  -> task contract
  -> artifact/source registration
  -> context eligibility
  -> context snapshot
```

Threats: ambiguous intent, malicious task, impersonation, silent inferred contract, poisoned upstream issue.

### DF-02 Model invocation

```text
selected context
  -> classification/provider decision
  -> model request
  -> model response
```

Threats: unapproved data export, injection, provider retention mismatch, hidden context omission, response manipulation.

### DF-03 Tool execution

```text
model proposal
  -> semantic action normalization
  -> policy/approval/grant
  -> sandbox/tool
  -> output classification
  -> artifact/evidence/event
```

Threats: parser bypass, approval replay, path escape, command composition, excessive effect, output injection.

### DF-04 Artifact/memory promotion

```text
generated/imported artifact
  -> provenance/integrity/scan
  -> review
  -> promotion
  -> future context/reuse
```

Threats: self-promotion, stale/poisoned canonical artifact, hidden conflicts, durable injection.

### DF-05 Monitoring and incident response

```text
security signal
  -> structured event
  -> correlation
  -> alert/containment
  -> incident/recovery
```

Threats: log leakage, alert injection, event suppression, control outage, false-positive fatigue, incomplete containment.

## 8. Security assumptions

### 8.1 Assumed for P0

- fixture repository contains no valuable secret or customer data;
- the host user account is not already compromised;
- local OS controls provide a baseline process/filesystem boundary;
- the emergency-stop controller has an execution path independent from the model;
- schema/rule artifacts in the reviewed branch are the intended design inputs;
- network denial and path restrictions can be verified by tests.

### 8.2 Explicitly not assumed

- prompt-injection detectors catch all attacks;
- internal files are trustworthy;
- signed content is correct;
- a read-only hint is accurate;
- a command parser fully understands shell behavior;
- a user approval is always informed;
- a model or subagent preserves task scope;
- redaction catches all sensitive data;
- an LLM judge is independent or unbiased;
- success exit codes prove task completion;
- local traces are harmless because they are local.

## 9. Threat register summary

| ID | Threat | Likelihood | Impact | Priority | Primary controls |
|---|---|---:|---:|---:|---|
| TM-001 | Direct prompt injection requests policy/permission bypass | High | High | P0 | Instruction/data boundary, task binding, external authorization |
| TM-002 | Indirect injection in web/file/tool output | High | Critical | P0 | Provenance, taint, restricted mode, least privilege, egress control |
| TM-003 | Internal artifact poisoning | Medium | Critical | P0 | Artifact authority/lifecycle, review, integrity, conflict/drift checks |
| TM-004 | Memory poisoning persists across tasks | Medium | Critical | P0/P1 | Draft-only memory, review, provenance, expiry, quarantine |
| TM-005 | Compaction drops security constraints | Medium | High | P0/P1 | Snapshot lineage, constraint-retention check, restricted mode |
| TM-006 | Task contract silently changes to attacker goal | Medium | Critical | P0 | Revisioned explicit task, material-drift detection, human confirmation |
| TM-007 | Shell parser misclassifies dangerous composition | High | Critical | P0 | Maximum-effect classification, unknown deny, sandbox, no network |
| TM-008 | Path traversal or symlink escape | Medium | Critical | P0 | Canonicalization, realpath recheck, task root, sandbox termination |
| TM-009 | Model output executes as shell/SQL/HTML/path | Medium | Critical | P0 | Typed adapters, strict schemas, sanitization, no direct execution |
| TM-010 | Approval replay or overbroad session cache | Medium | High | P0 | Request hash, task/resource/effect binding, expiry, R4/R5 no cache |
| TM-011 | Approval fatigue leads to uninformed consent | High | High | P0/P1 | Transaction summary, batching limits, risk-based prompts, deny defaults |
| TM-012 | Child agent obtains broader permission | Medium | Critical | P0/P1 | Distinct identity, subset grant, non-transitive grants, revocation |
| TM-013 | MCP/tool read-only hint hides write/exfiltration | Medium | Critical | P0/P1 | Effect classification, pinned manifest, output/destination checks |
| TM-014 | MCP manifest/schema/digest rug pull | Medium | Critical | P1 | Trust registry, change quarantine, reapproval |
| TM-015 | Token passthrough/confused deputy | Medium | Critical | P1 | Audience-bound tokens, separate downstream token, no passthrough |
| TM-016 | Secret copied into prompt, trace, memory, or alert | High | Critical | P0/P1 | Context block, secret broker, redaction, C4 prohibition, rotation |
| TM-017 | Sensitive data exported to model provider | Medium | Critical | P0/P1 | Classification, content mode, provider policy, local-only fallback |
| TM-018 | Exfiltration via URL/query/Markdown/remote render | Medium | Critical | P0/P1 | Network deny, egress/DLP, remote render block, SSRF controls |
| TM-019 | Encoded/chunked/covert egress bypasses simple filters | Low/Medium | Critical | P1 | Volume/entropy/sequence correlation, destination policy, rate limits |
| TM-020 | Raw trace or blob stolen locally | Medium | High | P0 | Private paths, restrictive modes, inventory, TTL, encryption roadmap |
| TM-021 | Event/log injection forges evidence or hides action | Medium | High | P0 | Structured events, escaping, hashes, sequence checks, source IDs |
| TM-022 | Audit or control-health gap goes unnoticed | Medium | Critical | P0/P2 | Control-health events, privileged fail closed, gap detection |
| TM-023 | Security alert leaks the sensitive content it reports | High | High | P0 | Evidence references, redacted schema, audited investigation view |
| TM-024 | Evaluator injection changes rubric or result | Medium | High | P1 | Isolation, delimiters/typed input, no tools, strict output, calibration |
| TM-025 | Same agent fabricates evidence for own change | High | High | P0 | Evidence independence/level, revision binding, separate validators |
| TM-026 | Test evidence validates stale revision | Medium | High | P0 | Target revision/hash binding and equivalence proof |
| TM-027 | Dependency/skill/package/model supply-chain compromise | Medium | Critical | P1 | Pinning, provenance, SBOM/AIBOM, signatures, vulnerability policy |
| TM-028 | Resource/cost loop causes denial or budget loss | High | Medium/High | P0 | Turn/tool/time/output budgets, loop detection, emergency stop |
| TM-029 | Sandbox/control outage fails open | Low/Medium | Critical | P0 | Explicit failure policy, health gating, fixture tests |
| TM-030 | Cross-project/tenant data access | Low in P0, higher hosted | Critical | P2 | Scoped identity, tenant isolation, authorization, audit |
| TM-031 | Administrator uses monitoring for employee ranking | Medium | High privacy harm | P2 | Anti-surveillance policy, aggregate cohort views, API denial |
| TM-032 | Deletion misses summaries, indexes, datasets, exports | Medium | High | P2 | Data inventory, lineage, propagation verification, visible failures |
| TM-033 | Model/provider/adapter version drift changes behavior | High | High | P0/P1 | Version capture, fixtures, canary, rollback, drift findings |
| TM-034 | Incident recovery restores poisoned memory/context/tool | Medium | Critical | P0/P1 | Clean restart, revalidation, rotation, minimum grants, recovery gates |

## 10. Detailed threat analysis

### 10.1 Prompt injection and authority confusion

#### TM-001 Direct injection

**Scenario:** A user or copied instruction explicitly tells the agent to ignore project/security controls, request full access, or hide actions.

**Control expectation:** The instruction is recorded as user content. It cannot override managed/project control artifacts or policy. Requested actions are independently evaluated.

**Residual risk:** The request may be a legitimate emergency need. Absolute model-side refusal would harm usability; deterministic policy and separate break-glass workflow are preferred.

#### TM-002 Indirect injection

**Scenario:** A repository file, web result, issue comment, tool output, or attachment includes instructions to read secrets or call an external destination.

**Attack chain:**

```text
untrusted source selected
  -> instruction interpreted as authority
  -> sensitive read requested
  -> generic approval accepted
  -> archive/encode
  -> external call
```

**Controls:** provenance and `data_only` authority; taint propagation; task-goal binding; protected-path deny; exact approvals; no network; sequence correlation.

**Residual risk:** The model may use malicious content indirectly in generated code without requesting an obviously suspicious tool. Review, testing, and artifact scanning remain required.

#### TM-003 Internal artifact poisoning

**Scenario:** A compromised PRD, `AGENTS.md`, skill, permission matrix, or runbook gains high authority because it is internal.

**Controls:** internal origin is not sufficient; immutable revision; authority lifecycle; required reviewers; conflict/drift detection; integrity check at context assembly; quarantine.

#### TM-004 Memory poisoning

**Scenario:** Untrusted/generated content is automatically stored as durable memory and injected into future unrelated tasks.

**Controls:** memory is an artifact; generated entries remain draft; task/project/classification scope; expiry; review before reuse; quarantine and deletion propagation.

#### TM-005 Compaction loss

**Scenario:** A compacted summary omits a protected-path restriction or changes `data_only` content into an instruction.

**Controls:** source snapshot lineage; retained/omitted source references; authority/classification/taint inheritance; security-constraint retention check; restricted mode on loss.

### 10.2 Task and evidence integrity

#### TM-006 Goal hijack through plan drift

A model modifies the task plan so an unrelated action appears necessary.

Controls:

- explicit/provisional/missing contract state;
- task revision history;
- material drift finding;
- plan artifacts cannot rewrite explicit intent;
- R3+ action must bind to current task and approved plan step.

#### TM-025 Fabricated self-validation

The same agent changes code, runs an irrelevant command, and reports completion.

Controls:

- evidence levels E0–E4;
- validator identity/independence;
- coverage statement;
- revision binding;
- acceptance criterion links;
- independent automation/human evidence for higher assurance.

#### TM-026 Stale evidence

A passing test from an earlier revision is attached to a later artifact.

Controls: exact source/target revisions and hashes, evidence expiry, equivalence proof, reducer drift finding.

### 10.3 Command, file, and execution threats

#### TM-007 Shell composition bypass

Examples:

```text
rg pattern . && curl ...
cat file > protected/path
VAR=$(cat secret) command
python -c '<generated code>'
trusted-wrapper --argument='; destructive-command'
```

Controls:

- structured semantic action preferred;
- parse composition and destinations;
- maximum plausible effect on incomplete parse;
- unknown deny;
- exact registered validator templates;
- no network and restricted filesystem;
- process/output/time budgets.

#### TM-008 Path and symlink escape

Controls:

- normalize and canonicalize before policy;
- reject absolute/unexpected roots;
- resolve symlinks at execution time;
- use directory handles or equivalent race-resistant methods when implementing;
- deny special files, sockets, devices, and protected local paths;
- terminate repeated attempts.

#### TM-009 Unsafe output handling

Model/tool output may contain HTML, terminal escapes, URLs, SQL, shell, templates, or paths.

Controls: context-specific escaping, CSP/remote-resource policy, terminal control stripping, typed APIs, strict unknown-field rejection, no `eval`, no direct SQL/shell interpolation.

### 10.4 Authorization and approval threats

#### TM-010 Approval replay

An approval for one file/command/destination is reused for another.

Controls: request hash; action/resource/arguments/effect/task/destination binding; short expiry; use count; session cache restrictions; revocation.

#### TM-011 Approval fatigue

Controls:

- do not ask for impossible/absolute-deny actions;
- show deterministic transaction summary;
- explain data destination and reversibility;
- group only identical low-risk signatures;
- rate-limit prompts;
- measure dismissal and blind-approval behavior;
- prefer safer alternative rather than repeated escalation.

#### TM-012 Agent delegation escalation

Controls: child identity, signed/recorded handoff, subset grants, no peer delegation, distinct audit, revoke on close, parent cannot hide child activity.

### 10.5 MCP, connector, and supply-chain threats

#### TM-013 Misleading tool metadata

A `read_only_hint` or description claims read-only while arguments/output cause mutation or egress.

Controls: treat hints as advisory; classify actual effect/destination; typed schemas; fixture verification; runtime observation; quarantine mismatch.

#### TM-014 MCP rug pull

Controls: pin identity, endpoint, publisher, package/image digest, tool description, input/output schema, scopes, destinations; detect change; block privileged use until reapproval.

#### TM-015 Token passthrough

Controls: resource/audience binding, separate downstream token, no token in model context/query string, short expiry, replay detection, secret broker.

#### TM-027 AI/software supply chain

Includes packages, skills, prompts, datasets, models, adapters, hooks, and generated binaries.

Controls: source and revision inventory, hash/signature, dependency review, SBOM/AIBOM, vulnerability/EOL policy, isolated builds, no unofficial mirrors for privileged assets.

### 10.6 Confidentiality and exfiltration threats

#### TM-016 Secret propagation

A secret may enter:

```text
prompt
context snapshot
model response
command output
trace
memory
artifact
alert
support bundle
child-agent handoff
```

Controls must occur before each boundary. Export-time redaction alone is insufficient.

#### TM-017 Provider leakage

Controls: C0–C4 classification, content mode, provider class, minimum context, local/private fallback, provider decision receipt, no P0 third-party judge.

#### TM-018 Rendering and SSRF leakage

Generated Markdown can use a remote image URL with sensitive query data; tools can follow redirects to local metadata.

Controls: no automatic remote render, proxy/allowlist when later enabled, URL canonicalization, redirect re-evaluation, private/link-local/metadata denial, DNS rebinding defense roadmap.

#### TM-019 Covert egress

Controls: no P0 external network; later egress volume/rate/entropy correlation; archive and encoding detection; destination allowlist; payload schema; sequence analysis.

#### TM-020 Local trace theft

Controls: private directory, restrictive permissions, inventory, TTL/delete, explicit import, no automatic home scan, encrypted local store roadmap, minimized content.

### 10.7 Monitoring, audit, and incident threats

#### TM-021 Event/log injection

Controls: structured fields, no free-form event-type/source authority, escaping, terminal-control removal, length limits, hashes, source IDs, sequence gap detection.

#### TM-022 Audit/control gap

Controls: control-health records; privileged fail closed; local buffering for non-blocking telemetry; missing audit freezes affected privileged workflow; user-visible degraded state.

#### TM-023 Alert leakage

Controls: evidence refs, redacted excerpts, no raw secret, destination policy, investigation view with separate audited content access.

#### TM-028 Resource exhaustion

Controls: source/content limits, token budgets, tool and child-agent counts, runtime/process/output limits, retry ceilings, queue backpressure, emergency stop.

#### TM-029 Control failure

Failure policy:

| Control | P0 behavior |
|---|---|
| Collector | Host task may continue locally; mark observation gap |
| Event store | Governed P0 execution stops if required audit cannot be persisted |
| Policy engine | R2+/R3+ fails closed |
| Sandbox | Execution fails closed |
| Path control | File operation fails closed |
| Secret detector | Synthetic fixture flow may continue only in explicit degraded test; real protected flow blocked |
| Alert delivery | Containment remains; buffer redacted event locally |
| Emergency stop | Profile is invalid; no execution starts |

### 10.8 Privacy and insider threats

#### TM-030 Cross-boundary access

P0 uses one local project, but schemas and tests must not assume that missing tenant IDs mean universal access.

#### TM-031 Employee surveillance

Security anomaly and AI-use data can be repurposed into individual performance scoring.

Controls: personal guidance private by default, aggregate workflow views, small-cohort suppression, separate raw-content permission, governance-denied leaderboard/export endpoints, access audit.

#### TM-032 Incomplete deletion

Controls: content inventory and lineage, derived index/summary/dataset tracking, deletion job evidence, external recipient inventory, visible failure and retry/escalation.

### 10.9 Drift and recovery threats

#### TM-033 Version drift

Controls: record model, client, adapter, mapping, schema, policy, rule, prompt/rubric, tool manifest, and context artifact revisions; fixture replay; canary; rollback.

#### TM-034 Poisoned recovery

Controls: clean context, rotate credentials, revalidate tools/artifacts, quarantine memory, minimum permission restoration, task outcome reclassification, post-incident fixture.

## 11. Attack trees

### 11.1 Read and exfiltrate sensitive data

```text
Goal: confidential data leaves approved boundary
├── Obtain data
│   ├── direct protected-path read
│   ├── tool/MCP broad enumeration
│   ├── poisoned artifact/context requests read
│   ├── child agent receives broad grant
│   └── secret already copied into trace/memory
├── Transform/hide
│   ├── archive
│   ├── encode
│   ├── split into chunks
│   └── embed in URL/Markdown/generated artifact
└── Transmit
    ├── model provider
    ├── HTTP/MCP/connector
    ├── Git push/PR/issue
    ├── email/message
    ├── remote render
    └── log/alert/support bundle
```

P0 breaks this tree through no valuable source data, protected-path deny, no external network/write, no live connectors, no third-party judge, and redacted local monitoring.

### 11.2 Persist malicious authority

```text
Goal: malicious instruction affects future tasks
├── enter context through external/tool/generated source
├── become draft plan/artifact/memory
├── self-assert trust or pass weak review
├── promote to approved/canonical
├── load automatically in future context
└── request privileged action
```

Controls: authority separate from origin, no self-promotion, immutable provenance, reviewer separation, unresolved-finding gate, expiry, drift/conflict detection, context eligibility.

### 11.3 Cause destructive action through approval

```text
Goal: user approves harmful action
├── make request appear task-relevant
├── hide exact resource/effect/destination
├── trigger repetitive prompts
├── reuse session/persistent approval
└── execute with broad tool credential
```

Controls: task/plan binding, deterministic transaction summary, exact request hash, bounded grant, R4/R5 restrictions, no token passthrough, approval metrics.

## 12. Privacy threat review

| Privacy threat | Example | Control |
|---|---|---|
| Overcollection | Full prompts/traces captured when metadata is sufficient | Content modes, minimum collection, explicit import |
| Linkability | Stable identity across unrelated projects/organizations | Scoped pseudonymous IDs and separate execution identity |
| Secondary use | Security/usage events used for employee ranking | Product/API governance prohibition |
| Excessive retention | Raw traces retained indefinitely | TTL, inventory, deletion evidence |
| Unauthorized access | Manager or support reads raw prompt | Separate JIT/break-glass permission and audit |
| Inference | Aggregated small cohort identifies one user | Minimum cohort and suppression |
| External disclosure | Judge/SIEM/support bundle receives raw content | Export policy, redaction, recipient inventory |
| Correction failure | Poisoned memory remains after user correction | Artifact lifecycle, lineage, deletion propagation |

## 13. Security control dependencies

A control can be present but ineffective if a dependency is unhealthy.

Examples:

- egress DLP depends on destination visibility and canonical URL resolution;
- path control depends on race-resistant canonicalization;
- permission revocation depends on the tool gateway checking active grants;
- alert confidentiality depends on redaction before the alert sink;
- artifact integrity depends on trusted source revision and hash computation;
- evidence validity depends on target revision binding;
- emergency stop depends on independent process/grant/egress control.

Each critical control records health and failure behavior. A green model response is never a control-health signal.

## 14. Required threat-model validation

### P0 blocking tests

- direct and indirect injection cannot create authority or permission;
- protected paths and symlink escapes fail closed;
- unknown/compound commands cannot bypass classification;
- no external network or remote render succeeds;
- P0 session approval cannot broaden resource/effect;
- child agent cannot inherit write permission;
- unreviewed memory/artifact cannot become active context authority;
- evidence against stale revision is rejected or marked invalid;
- security event and alert fixtures contain no synthetic secret value;
- missing policy/sandbox/audit/emergency-stop control blocks governed execution;
- emergency stop terminates nested process and revokes grants;
- replay reproduces decisions and records observation gaps.

### P1 blocking tests

- MCP manifest rug pull quarantines server;
- OAuth/resource audience mismatch is rejected;
- token passthrough is blocked;
- secret broker value never enters model/event/alert;
- egress DLP blocks confidential and encoded payloads;
- evaluator injection cannot change rubric or obtain tools;
- credential rotation and clean recovery drill succeed.

### P2 blocking tests

- cross-tenant/project access fails;
- raw-content JIT/break-glass access is audited;
- cohort privacy suppression works;
- retention/deletion propagates through derived systems;
- audit tampering freezes privileged workflows;
- incident notification and recovery gates are exercised.

## 15. Residual risks

Even with all planned controls:

- semantic prompt injection cannot be perfectly identified;
- a user may intentionally authorize unsafe work;
- deterministic command/effect classification will have unsupported cases;
- local host compromise defeats local confidentiality;
- approved dependencies or model providers may be compromised later;
- a valid test may miss defects or malicious behavior;
- data classification and redaction will produce false positives and false negatives;
- anomaly correlation may be noisy;
- organization policy may override privacy-friendly defaults outside product control.

The product MUST expose these limitations and avoid claims of guaranteed prompt-injection prevention or complete data-loss prevention.

## 16. Open decisions

1. Concrete sandbox implementation and measured guarantees by OS.
2. Race-resistant filesystem API and symlink policy.
3. Local encryption/key-storage design.
4. Policy engine and normalized action parser implementation.
5. Redaction/classification rule sources and organization extension format.
6. Signed event batch and audit integrity mechanism.
7. Pseudonymous actor-ID derivation and rotation.
8. Hosted tenant key separation and break-glass process.
9. DNS rebinding and proxy architecture for later network profiles.
10. Security review cadence for models, skills, MCP servers, and evaluator rubrics.

## 17. Gate decision

P0 may proceed only against sanitized fixtures after schema validation and abuse-case fixtures are prepared. Real repositories, network, credentials, external tools, or managed content remain blocked until their corresponding P1/P2 controls and recovery drills pass.
