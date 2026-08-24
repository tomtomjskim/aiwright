# AIwright Protocol v0.1 — amendment 1

> **Status:** Draft / normative amendment  
> **Date:** 2026-08-24  
> **Precedence:** This document amends `protocol-v0.1.md` where explicitly stated

## 1. Purpose

The first M1 review found protocol concerns that were material enough to encode before runtime implementation. This amendment adds delegation, projection provenance, canonicalization, bounded metadata, security-preview privacy, explicit task confirmation, and crash-safe raw-observation persistence requirements.

## 2. Delegation is a governed protocol object

A parent/child or service delegation is not inferred only from chat messages or thread topology.

Every active delegation MUST have a `delegation-record.schema.json` object containing:

- distinct delegator and delegate execution identities;
- exact task/run and purpose;
- a versioned handoff statement/hash;
- allowed context and artifact revisions;
- parent and child grant references;
- a deterministic subset-check result;
- expiry, close, revocation, and active-call termination behavior;
- result and source references.

An agent message cannot transfer permission. A child delegation cannot become active unless its capability set is proven equal to or narrower than the parent and project policy.

## 3. Derived output requires a projection manifest

Every task graph, timeline, evaluation report, security correlation, and outcome report MUST reference a `projection-manifest.schema.json` object.

The manifest records:

- exact adapter/stream source ranges and hashes;
- event counts and completeness;
- sequence, visibility, relationship, integrity, and control-observation gaps;
- protocol, adapter, mapping, reducer, redaction, retention, permission, security-rule, and evaluator versions;
- canonical input/output hashes;
- unsupported event types/fields;
- superseded projection identity.

A report without this manifest may be displayed as an unverified diagnostic draft but MUST NOT be represented as reproducible evidence.

## 4. Canonicalization and hashing

### 4.1 JSON protocol objects

Canonical hash inputs SHOULD use JSON Canonicalization Scheme (JCS, RFC 8785) encoded as UTF-8.

If an implementation cannot use JCS, it MUST:

- assign a stable canonicalization name/version;
- publish deterministic test vectors;
- include the canonicalization identifier in the projection or integrity metadata;
- prevent different canonicalization versions from being compared as equal without migration evidence.

### 4.2 Content blobs

Blob hashes apply to exact raw bytes. Media type, source revision, and any content normalization MUST be recorded separately. Text newline or Unicode normalization MUST NOT occur silently before hashing.

### 4.3 Privacy warning

A hash is an integrity and correlation value, not anonymization. Short, predictable, low-entropy, restricted, secret, or personal values can be recovered through dictionary or correlation attacks.

C3/C4 or `secret_detected` security events MUST NOT store preview text or preview hashes. Secret inventory may use separately protected keyed fingerprints or secret-broker identifiers in a later design; plain content hashes are not sufficient.

## 5. Event metadata boundary

`event-envelope.payload.metadata` contains only bounded scalar values or bounded arrays of scalar values.

The following MUST use a classified content pointer rather than indexed metadata:

- nested provider payloads;
- command/tool output;
- prompt/message bodies;
- stack traces;
- arbitrary structured tool arguments/results;
- large arrays;
- binary or encoded data;
- customer, secret, or C3/C4 content.

Implementations MUST enforce total event size, metadata depth, property count, scalar length, and array limits before persistence and export. Namespaced `extensions` do not bypass content, classification, size, or authority rules.

## 6. Security-event naming and rule identity

Security `event_type` uses an open lowercase namespaced syntax. Its semantics are controlled by:

```text
rule_id
rule_version
policy_id
policy_version
control_id / enforcement point
```

This permits domain packs and new controls without changing the root schema for every event. Event names MUST NOT be used as the sole authorization or severity decision.

## 7. Explicit task confirmation

A task with `contract_state=explicit` MUST contain:

- non-empty intent;
- non-null confirmer actor;
- non-null confirmation timestamp;
- revision history.

Generated or inferred acceptance criteria may remain proposed, but the product MUST distinguish them from confirmed criteria. A plan or model message cannot confirm the task on behalf of the user or authoritative upstream workflow.

## 8. Crash-safe local raw observation persistence

### 8.1 Source of truth

The local raw event store remains append-only and separate from SQLite projections.

### 8.2 Write ordering

When an event references content:

1. write content to a private staging path;
2. flush and close the content object according to the configured durability level;
3. atomically publish or rename the content object;
4. append the canonical event record referencing that object;
5. update a segment checkpoint only after the event append is complete;
6. build projections only through the latest committed checkpoint.

An event MUST NOT reference a content object that has not been durably published.

### 8.3 Segment and checkpoint rules

The local spool SHOULD use bounded segments with:

- segment identity and creation metadata;
- monotonically increasing writer sequence within one stream;
- record count and rolling/segment hash;
- committed checkpoint;
- writer/process identity and lock ownership;
- close/finalize state.

A single writer owns one segment. Multi-process ingestion requires an explicit coordinator or separate source segments; implicit concurrent append is prohibited.

### 8.4 Recovery

On startup:

- preserve and report an incomplete final record before truncation/recovery;
- compare checkpoint, record count, and hash;
- never silently repair or skip middle corruption;
- mark incomplete or corrupted source ranges in the projection manifest;
- quarantine orphan content objects until retention/reconciliation decides their fate;
- keep the original damaged segment as bounded incident evidence when policy allows.

### 8.5 Durability profiles

A local implementation MAY expose durability profiles, but the selected profile is recorded:

```text
best_effort_observation
checkpointed_local
security_audit_required
```

`security_audit_required` governed actions fail closed if the required request, decision, grant, and execution audit cannot be persisted.

## 9. Profile-scoped project requirement

Protocol v0.1 `local-core` remains project-bound and requires `project_id`.

Pre-project, tenant-only, and organization-wide objects are deferred to a managed-profile scope union in Protocol v0.2. Implementations MUST NOT abuse a synthetic global project to bypass future tenant/resource authorization.

## 10. Authorization binding gap

Before execution code, authorization schema v0.1.1 MUST bind:

- approval receipt to canonical permission-request hash;
- permission grant to request, policy-decision, and approval hashes;
- grant use to current request/resource/effect hash;
- session cache to exact action/resource/argument/effect/task signature;
- revocation to active-call observation behavior.

ID references alone are not sufficient against mutation, replay, or TOCTOU.

## 11. Validation gate

The zero-dependency repository validator is an integrity preflight only. M1 closure requires:

- a standards-compliant JSON Schema 2020-12 validator;
- positive and negative examples per root schema;
- canonicalization test vectors;
- semantic conformance tests for cross-object rules;
- malformed, partial, duplicate, and out-of-order event cases;
- privacy and forbidden-literal assertions.

## 12. Amendment status

Implemented in schema drafts:

- delegation record;
- projection manifest;
- bounded event metadata;
- open namespaced security events;
- C3/C4/secret preview and hash suppression;
- concrete explicit-task confirmation.

Still open:

- authorization request/decision/approval/grant hash binding;
- crash-safe spool implementation and fault injection;
- full JSON Schema validation/examples;
- executable action catalog;
- managed-scope union.