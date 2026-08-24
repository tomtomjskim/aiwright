# AIwright Platform — P0 Codex permission and action-risk matrix

> **Status:** Draft / implementation gate  
> **Version:** 0.1  
> **Date:** 2026-08-24  
> **Profile:** `codex-local-fixture`  
> **Scope:** Sanitized local vertical slice using disposable repositories and no live credentials

## 1. Decision

The P0 pilot uses Codex as a structured event and execution source, but AIwright owns the normalized action classification and final authorization contract.

Codex approval and sandbox configuration are useful host controls. They are not treated as proof that an action is safe, task-relevant, correctly classified, or authorized for AIwright purposes.

```text
Codex proposal/event
  -> normalized semantic action
  -> AIwright risk classification
  -> task/resource/effect policy
  -> optional approval receipt
  -> bounded grant
  -> Codex sandbox/tool execution
  -> evidence and security events
```

AIwright may narrow host permissions. It MUST NOT broaden a restriction imposed by Codex, the operating system, project policy, or a managed configuration layer.

## 2. Current Codex control surface used by this design

The current Codex app-server protocol exposes:

- approval policies including `untrusted`, `on-request`, granular approval controls, and `never`;
- sandbox modes `read-only`, `workspace-write`, and `danger-full-access`;
- workspace-write roots and an explicit network-access flag;
- managed requirements that can constrain allowed approval policies, sandbox modes, permission profiles, hooks, browser/computer use, and network;
- approval decisions for commands and file changes, including session-scoped acceptance and proposed policy amendments;
- structured thread items for user/hook prompts, plans, command execution, file changes, MCP/dynamic tools, collaborative agents, web search, and context compaction.

The P0 profile uses these source capabilities conservatively:

- `danger-full-access` is prohibited;
- workspace-write is restricted to one disposable task worktree and AIwright local data paths;
- network is disabled by default;
- granular permission requests are preferred;
- session approvals are not translated to broad or persistent AIwright grants;
- Codex `read_only_hint` and parsed command actions are advisory inputs only.

## 3. P0 environment assumptions

P0 is not a production security profile. It exists to validate protocol and controls without valuable blast radius.

Required environment:

- sanitized fixture repository or disposable clone/worktree;
- no production or personal repository;
- no `.env`, SSH key, cloud credential, browser profile, mailbox, customer data, or production database access;
- no host Docker socket;
- no privileged container/runtime access;
- no cloud metadata access;
- no external write-capable MCP or connector;
- no real deployment, merge, push, send, publish, or delete permission;
- network disabled except separately declared loopback fixture services;
- restrictive local file permissions and bounded retention;
- out-of-band emergency stop.

Any violation of these assumptions blocks the P0 profile and requires a later profile review.

## 4. Normalized action format

```text
namespace.resource.effect
```

Examples:

```text
filesystem.path.read
filesystem.path.write
git.repository.inspect
git.branch.commit
network.destination.fetch
mcp.tool.invoke_read
agent.child.spawn
artifact.revision.promote
```

Authorization evaluates actual effect. Tool or command name is not sufficient.

## 5. Default P0 policy summary

| Control | P0 default |
|---|---|
| Codex sandbox | `workspace-write` only; exact disposable root |
| Network | Disabled; loopback fixture exception only |
| Host home access | Denied except explicit AIwright local data paths |
| Secrets | No live secret values; synthetic fixtures only |
| MCP | Disabled except pinned, loopback, synthetic read-only fixture server |
| Child agents | Read-only fixture work allowed; write-capable child denied |
| External actions | Denied |
| Git remote mutation | Denied |
| Artifact promotion | Draft/review only; canonical/security-policy promotion denied |
| Raw trace access | Explicit local user action; agent does not enumerate unrelated traces |
| Approval lifetime | One action by default; bounded task/session cache only for exact low-risk signatures |
| Fail behavior | Governed actions fail closed when policy, sandbox, secret, or audit controls are unavailable |

## 6. Exact action matrix

### 6.1 Project, filesystem, and content

| Action | Typical Codex source | Risk | P0 decision | Required scope/limits | Approval | Security event / evidence |
|---|---|---:|---|---|---|---|
| `project.metadata.read` | Config/project discovery | R0 | Allow | Current fixture project only | None | Audit only |
| `filesystem.directory.list` | Command action `ListFiles` | R1 | Allow | Canonical path under allowed root; bounded entries | None | Tool event; traversal attempt alerts |
| `filesystem.content.search` | Command action `Search`, `rg` | R1 | Allow | Allowed root; bounded matches/bytes | None | Tool event; bulk enumeration correlation |
| `filesystem.path.read` | Command action `Read`, file viewer | R1 | Allow | Allowed root; C0/C1 fixture content; byte limit | None | Read event; evidence reference, no full log copy |
| `filesystem.path.read_protected` | `.env`, credentials, key material, browser/profile, unrelated home paths | R5 | Deny | No exception in P0 | Not applicable | `secret.context.blocked` or path-denied event |
| `filesystem.path.write` | FileChange, patch | R3 | Allow with obligations | Disposable task worktree; max files/bytes; diff preview; no protected paths | Pre-approved task grant or one-time confirmation when outside plan | Artifact revision plus policy decision |
| `filesystem.path.create` | FileChange, patch | R3 | Allow with obligations | Same as write; allowed file types; no device/socket/special file | Same as write | Artifact event |
| `filesystem.path.delete_generated` | Remove known generated temporary file | R3 | Allow only when provenance proves generated-by-current-run | Max files; reversible or reproducible | Exact one-time or approved plan step | Deletion evidence |
| `filesystem.path.delete_existing` | `rm`, patch delete | R4 | Deny in default P0 | User may perform manually outside agent | Not available | Blocked-action event |
| `filesystem.permission.change` | `chmod`, ACL | R5 | Deny | None | Not available | P1/P0 depending target |
| `filesystem.path.escape` | Traversal, symlink escape | R5 | Deny and terminate repeated attempt | Canonicalization and realpath boundary | Not available | `sandbox.violation` |
| `content.raw_trace.import` | Rollout trace importer | R2 | User-initiated local allow | Explicit selected bundle; local-only; inventory/TTL; no automatic directory scan | Hard local confirmation | Import receipt; privacy report |
| `content.raw_trace.read` | Analysis of imported trace | R2 | Allow only to local reducer/evaluator profile | Imported bundle only; no external model export | Task-bound grant | Content access audit |
| `content.managed_export` | Exporter/model judge | R4 | Deny in P0 | None | Not available | `model_export.blocked` / `telemetry_export.blocked` |

### 6.2 Commands and local execution

| Action | Examples | Risk | P0 decision | Required controls | Approval | Notes |
|---|---|---:|---|---|---|---|
| `command.inspect.execute` | `pwd`, `git status`, `git diff`, `git log`, bounded `find`, `rg` | R1 | Allow | Semantic parser or exact configured command class; allowed cwd; timeout/output limit | None | Pipes/redirections can change effect and require reclassification |
| `command.validation.execute` | Approved lint, typecheck, unit test, schema validation | R3 | Allow with bounded grant | Exact command template/hash; sandbox; no network; timeout; process/output limits | Task plan or configured validator grant | Produces E2 evidence only for exact revision |
| `command.build.execute` | Local build without external side effect | R3 | Allow only if command is predeclared | No network; disposable output paths; resource budget | Task grant; first-run preview | Build success is not task completion proof |
| `command.package.install` | `npm install`, `pip install`, OS package manager | R4 | Deny in P0 agent flow | Dependencies preinstalled or fixture lock/cache prepared by user | Not available | Supply-chain and network scope deferred to P1 |
| `command.interpreter.execute` | Arbitrary Python/Node/Ruby script | R3–R5 | Deny unless exact test fixture script is registered | Script hash, cwd, input/output, no network, sandbox | Exact one-time/task grant | Unknown generated script is not auto-approved |
| `command.shell.unknown` | Parser returns `Unknown`; command substitution/eval/complex shell | R3–R5 | Deny by default | Requires manual classification in later profile | Not available in autonomous P0 | `tool.arguments.invalid` or blocked-action event |
| `command.destructive.execute` | `rm -rf`, disk tools, process kill outside child tree, DB destructive commands | R5 | Deny | None | Not available | Terminate run on repeated/high-confidence attempt |
| `command.privileged.execute` | `sudo`, setuid, kernel/host configuration | R5 | Deny | None | Not available | Critical event |
| `process.long_running.start` | Server/watch process | R3 | Allow only registered fixture service | Process tree, port, timeout, cleanup, loopback only | Task grant | Must be terminable by emergency stop |
| `process.signal.current_tree` | Stop current fixture child process | R3 | Allow | Current task process tree only | None/task grant | Do not allow arbitrary PID targeting |

### 6.3 Git and repository actions

| Action | Risk | P0 decision | Scope and obligations | Approval |
|---|---:|---|---|---|
| `git.repository.inspect` | R1 | Allow | Fixture repo; status/diff/log/show/rev-parse; output limits | None |
| `git.branch.create_task` | R3 | Allow | New non-protected local branch/worktree with approved prefix | Task grant |
| `git.index.stage` | R3 | Allow with exact paths | Only current task-owned changed paths; never `git add -A`/`.` | Diff preview or task policy |
| `git.branch.commit` | R3 | Allow once when requested by task | Local task branch; deterministic path inventory; no signing-key access | One-time explicit approval or explicit task contract |
| `git.branch.reset_safe` | R3 | Allow only to agent-owned uncommitted changes when rollback artifact exists | Exact paths/revision | Explicit rollback plan |
| `git.repository.clean` | R5 | Deny | No `clean -fdx`, broad checkout/restore, or destructive reset | Not available |
| `git.remote.fetch` | R3 | Deny by default | Later profile may allow approved remote read with network policy | Not available |
| `git.remote.push` | R4 | Deny | No remote mutation in P0 | Not available |
| `git.pull_request.create_or_update` | R4 | Deny | No credentialed connector in P0 | Not available |
| `git.branch.merge` | R4 | Deny | No merge/protected-branch mutation | Not available |
| `git.remote.force_push` | R5 | Deny | Absolute policy deny for normal profiles | Not available |
| `git.repository.settings_or_access.change` | R5 | Deny | None | Not available |

### 6.4 Network and web

| Action | Risk | P0 decision | Scope/controls | Approval |
|---|---:|---|---|---|
| `network.loopback.fixture` | R1 | Allow by exception | Registered loopback port/process; no redirect to non-loopback | Task grant |
| `network.web.search` | R1–R2 | Disabled in default P0 | Optional fixture mode uses synthetic/local search corpus | Separate profile change |
| `network.destination.fetch` | R2–R4 | Deny | No arbitrary external HTTP/DNS | Not available |
| `network.metadata.access` | R5 | Deny | Block link-local/cloud metadata and local admin endpoints | Not available |
| `network.destination.write` | R4–R5 | Deny | No webhooks, uploads, messages, or API mutations | Not available |
| `render.remote_resource.load` | R2–R4 | Deny | Markdown/HTML image, font, iframe, link preview auto-fetch disabled | Not available |

### 6.5 MCP, tools, and connectors

| Action | Risk | P0 decision | Required controls | Approval |
|---|---:|---|---|---|
| `mcp.server.discover_fixture` | R0 | Allow | Pinned loopback fixture manifest only | None |
| `mcp.tool.invoke_read_fixture` | R1 | Allow | Read-only synthetic data, pinned schema/digest, effect checked independently of hint | Task grant |
| `mcp.tool.invoke_write` | R3–R5 | Deny | Deferred to P1 Tool Trust Registry and authorization | Not available |
| `mcp.server.changed` | R3+ | Quarantine | Any manifest/schema/description/digest/scope change | Re-review required; unavailable in P0 |
| `connector.authenticate` | R4–R5 | Deny | No live OAuth/token flow in P0 | Not available |
| `connector.secret.resolve` | R5 | Deny | Synthetic secret fixtures may exercise broker contract without real value | Not available |
| `dynamic_tool.invoke_unknown` | R3–R5 | Deny | No unregistered dynamic tools | Not available |
| `tool.output.attach_context` | R1–R3 | Allow after classification | Output treated as untrusted data; size/secret/injection checks; taint propagated | None or restricted-mode obligations |

### 6.6 Agents, plans, memory, and governed artifacts

| Action | Risk | P0 decision | Scope/controls | Approval |
|---|---:|---|---|---|
| `agent.child.spawn_read_only` | R1 | Allow in fixture tests | Distinct child identity; exact handoff; subset read grant; no network/secrets | Task policy |
| `agent.child.spawn_write` | R3 | Deny in default P0 | Deferred until delegation/revocation tests pass | Not available |
| `agent.child.send_message` | R1–R2 | Allow within root task | Recorded source/receiver; content classification; no permission transfer | Task policy |
| `agent.child.stop` | R1 | Allow | Root-task child only; revoke grants | None |
| `task.plan.create_draft` | R1 | Allow | Generated draft authority only | None |
| `task.plan.update_draft` | R2 | Allow | Revisioned; cannot silently change explicit task intent | User notified on material drift |
| `task.contract.confirm` | R3 | Human-only | User confirms explicit target | User action |
| `memory.entry.capture_draft` | R2–R3 | Allow local draft only | Provenance, classification, TTL, taint; excluded from future context until reviewed | User review before reuse |
| `memory.entry.promote` | R4 | Deny in P0 | No automatic durable/canonical memory | Not available |
| `artifact.revision.register` | R1–R3 | Allow | Immutable revision/hash/provenance | Task grant |
| `artifact.revision.promote_reviewed` | R3 | Allow only for non-security fixture artifact | Separate reviewer; no critical findings | Explicit reviewer action |
| `artifact.revision.promote_control_or_canonical` | R4–R5 | Deny in P0 agent flow | Human governance workflow required | Not available |
| `policy.or_permission_artifact.modify` | R5 | Deny | Agent may propose draft only | Not available |

### 6.7 Evaluation, monitoring, and incident actions

| Action | Risk | P0 decision | Scope/controls | Approval |
|---|---:|---|---|---|
| `evaluation.deterministic.run` | R1–R2 | Allow | Local rules, fixture content policy, versioned output | None/task policy |
| `evaluation.llm_judge.run` | R2–R4 | Deny in default P0 | No third-party content export; may use synthetic local stub only | Not available |
| `security.event.record` | R1 | Allow | Structured, redacted, append-only | None |
| `security.alert.local_display` | R1 | Allow | No raw secrets; deduplication | None |
| `security.alert.external_send` | R4 | Deny | No SIEM/external alert connector in P0 | Not available |
| `incident.create_local` | R2 | Allow | Local metadata/evidence refs; bounded content | None/task policy |
| `emergency_stop.activate` | R0 for authorized human/control | Allow | Out-of-band scoped stop; audited | Human/control action; model can only suggest |
| `emergency_stop.disable` | R5 | Deny during active incident except separate recovery workflow | No agent authority | Not available |

## 7. Approval translation rules

### 7.1 One-time approval

A Codex command/file approval can satisfy an AIwright approval only when the displayed transaction summary exactly matches:

- normalized action;
- canonical resource;
- important arguments;
- requested effect limits;
- destination and data classification;
- task/run;
- request hash;
- expiry.

Mismatch or missing data fails closed.

### 7.2 Session acceptance

Codex `AcceptForSession` MUST NOT become an unrestricted session grant.

AIwright MAY issue a bounded grant only for the same:

```text
action class
resource pattern
argument constraints
effect limits
data classification
destination policy
task/run
```

P0 permits session caching only for R1 and narrowly bounded R3 validation/write actions. R4/R5 never use session approval.

### 7.3 Policy amendments

A proposed execution/network policy amendment is a governed artifact draft. It requires:

- exact diff;
- provenance;
- security classification;
- conflict/drift review;
- approval by the correct policy owner;
- versioned publication;
- rollback path.

It MUST NOT be applied as an incidental side effect of a rushed command approval in P0.

## 8. Command classification rules

1. Prefer structured tool/action metadata.
2. Parse command composition, redirects, pipes, substitutions, environment assignments, interpreters, and destination effects.
3. Classify by the maximum plausible effect when parsing is incomplete.
4. `Unknown` is not read-only.
5. Read-like commands become writes when they redirect, upload, modify caches outside approved paths, or invoke hooks.
6. A configured validator command is bound to its exact executable/script/lockfile revision and arguments.
7. Shell aliases, functions, PATH changes, and wrapper scripts invalidate naive name-based allowlists.
8. Path canonicalization occurs before policy evaluation and again inside the execution boundary.

## 9. Required P0 negative fixtures

- read `.env`, SSH/cloud credential, browser-profile, and parent-directory files;
- symlink escape from allowed worktree;
- `git add -A` captures unrelated changes;
- validation command amended with `&& curl ...`;
- read command redirected to a protected or external destination;
- unknown shell with command substitution;
- generated script attempts network or metadata access;
- package installation attempts supply-chain/network access;
- MCP read-only hint conflicts with observed write effect;
- MCP manifest changes after approval;
- child agent receives parent write grant;
- prompt/tool output requests permission expansion;
- session approval reused for a different resource or argument;
- artifact promotes its own generated policy;
- memory draft becomes future context without review;
- raw trace export attempts third-party model evaluation;
- security alert payload contains a synthetic secret;
- emergency stop fails to terminate nested process/child agent.

## 10. Required P0 positive fixtures

- bounded file list/search/read under allowed root;
- planned file write with exact diff and effect limits;
- registered no-network test command produces revision-bound evidence;
- local task branch creation and exact-path staging;
- read-only child agent receives a narrower grant and is revoked on close;
- external-untrusted tool output enters context as `data_only` with taint;
- suspected injection activates restricted mode without granting extra rights;
- local security event is recorded without raw secret content;
- task-scoped emergency stop terminates process tree and revokes grants;
- replay reproduces the same policy decisions from the same versions and inputs.

## 11. Reviewer gates before P1

P1 credentialed tools are blocked until reviewers confirm:

- normalized action coverage is sufficient for actual Codex event fixtures;
- command classification has explicit unsupported cases;
- policy decisions and approval receipts validate against schemas;
- sandbox and emergency-stop behavior is measured, not assumed;
- MCP/tool manifest pinning and change quarantine work;
- secret broker and egress gateway prevent raw credential/model exposure;
- false-positive and approval-fatigue metrics are acceptable;
- no P0 bypass relies on a model statement or prompt instruction.
