# AIwright Protocol v0.1 — schema catalog

> **Status:** Draft  
> **Dialect:** JSON Schema 2020-12  
> **Purpose:** Machine-readable contracts for the local-core protocol profile

## Files

| Schema | Root type | Purpose |
|---|---|---|
| `common.schema.json` | Shared `$defs` | IDs, scope, actor, source, privacy, content, classification, risk, integrity |
| `event-envelope.schema.json` | `EventEnvelope` | Append-only normalized observation envelope |
| `task-contract.schema.json` | Task object union | Explicit/provisional/missing task contract and task-session association |
| `artifact-manifest.schema.json` | `ArtifactManifest` | Governed artifact identity, immutable revision, provenance, authority, context policy, and relations |
| `context-snapshot.schema.json` | `ContextSnapshot` | Exact context sources, authority, visibility, taint, ordering, provider decision, and compaction lineage |
| `evidence-record.schema.json` | `EvidenceRecord` | Claim/evidence scope, revision, validator, independence, coverage, result, and limitations |
| `authorization.schema.json` | Authorization object union | Permission request, policy decision, approval receipt, permission grant, revocation |
| `security-event.schema.json` | `SecurityEvent` | Detection, policy decision, evidence references, response actions, control health, and disposition |
| `incident-record.schema.json` | `IncidentRecord` | Correlated events, affected resources, containment, transitions, recovery gates, and residual risk |

## Validation rules

- All schemas use `additionalProperties: false` for normative objects.
- Provider- or domain-specific fields belong in an explicit `extensions` object with namespaced keys.
- Content bodies are not embedded by default. Schemas use content pointers, hashes, or approved external references.
- Null is permitted only where the protocol explicitly allows an unknown or local-mode boundary.
- A schema-valid object is not automatically trustworthy or authorized. Provenance, policy, lifecycle, and evidence gates still apply.

## Repository validation

Run:

```bash
npm run validate:rfc-schemas
```

The zero-dependency validator:

- parses every `*.schema.json` file;
- verifies JSON Schema 2020-12 dialect declarations;
- rejects duplicate or missing `$id` values;
- resolves local file and JSON Pointer `$ref` values;
- rejects references that escape the schema directory;
- rejects external schema references in the local-core catalog.

CI runs the command before the existing test, typecheck, distribution, and audit steps.

This validator checks catalog integrity. It does not replace a standards-compliant JSON Schema evaluator or semantic policy tests.

## Versioning

These files implement Protocol `0.1.0`. A mapping adapter records its own version separately.

```text
protocol schema version
source adapter version
mapping version
redaction policy version
reducer version
evaluator version
permission policy version
security rule version
```

## Intended implementation flow

1. Validate source-adapter output against `event-envelope.schema.json`.
2. Persist raw envelopes append-only.
3. Validate governed projections against the relevant object schema.
4. Record schema and reducer versions on every projection.
5. Run positive, negative, partial-stream, tamper, privacy, and replay fixtures.

## Known limitations

- These are design schemas and have not yet passed a full runtime conformance suite with positive/negative examples.
- The repository validator checks JSON and local reference integrity, not the complete JSON Schema 2020-12 semantics.
- Cross-schema semantic rules such as “child grants cannot exceed parent grants” require deterministic code or policy tests in addition to JSON Schema.
- Cryptographic signature verification, content-store ACLs, and deletion propagation are outside JSON Schema.
- OpenTelemetry and provider mappings remain separate adapter artifacts.
