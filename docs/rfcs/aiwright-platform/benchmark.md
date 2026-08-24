# AIwright Platform — adjacent-system benchmark

> **Snapshot date:** 2026-08-21  
> **Purpose:** Identify reusable architecture and product patterns. This is not a feature-count contest.  
> **Source policy:** Primary project documentation, repositories, and specifications only.

## 1. Benchmark question

The relevant question is not “Which LLM observability product has the most dashboard features?” It is:

> Which existing systems already solve capture, tracing, evaluation, prompt management, gateway integration, or standards well, and what remains unsolved for outcome-centric human–AI work improvement?

AIwright Platform should integrate with or learn from mature adjacent systems rather than rebuilding every observability capability.

## 2. Market and open-source map

| System | Primary strength | Patterns worth borrowing | Boundary or remaining gap for AIwright Platform |
|---|---|---|---|
| [Langfuse](https://langfuse.com/docs) | Open-source LLM engineering platform covering tracing, prompt management, evaluation, datasets, experiments, human annotation, usage, latency, and cost | OpenTelemetry-based SDK direction; prompt/version linkage; async best-effort capture; traces grouped by users and sessions; production-to-evaluation loop | Primarily observes LLM application behavior. AIwright must add a user-level task contract, cross-session task graph, artifact validation, intervention tracking, and anti-surveillance policy. |
| [Arize Phoenix](https://arize.com/docs/phoenix) and [OpenInference](https://github.com/Arize-ai/openinference) | Open-source tracing, evaluation, datasets, experiments, prompt iteration, and an instrumentation semantic layer | Transparent traces; OTLP/OpenInference interoperability; evaluator diversity; datasets and experiments as first-class objects | Strong evaluation substrate, but AIwright must own the human/agent task boundary and coaching contract rather than treating each trace as the final unit. |
| [Opik](https://www.comet.com/docs/opik/) | Open-source tracing, online evaluation, prompt management/optimization, datasets, and production failure analysis | Convert failed traces into regression cases; evaluator versioning; thread-level analysis; prompt optimization as a reviewed loop | Close adjacent competitor for diagnosis and optimization. Differentiation requires evidence-linked user/workflow guidance, artifacts and validation, intervention-effect tracking, local privacy modes, and non-ranking organizational UX. |
| [Helicone](https://docs.helicone.ai/) | Gateway-first LLM observability, sessions, user analytics, cost and operational visibility | Low-friction gateway instrumentation; unified request path; session trees; user and cost attribution | Gateway capture cannot cover local CLI/runtime details, file artifacts, validations, or work that bypasses the gateway. AIwright should support gateways as one adapter rather than make them mandatory. |
| [Promptfoo](https://www.promptfoo.dev/docs/intro/) | Open-source CLI and CI/CD evaluation/red-teaming for prompts, models, agents, and RAG | Test-driven LLM development; fixture/config-based evals; regression gates; adversarial testing in CI | Best used as an offline/CI evaluation integration. It does not replace continuous task/session reconstruction or personal/team guidance. |
| [OpenLLMetry / Traceloop](https://www.traceloop.com/docs/openllmetry/introduction) | Open-source, OpenTelemetry-based non-intrusive instrumentation across LLM frameworks and providers | Auto-instrumentation; export to existing observability backends; provider/framework adapters | Valuable capture layer. AIwright must add task semantics, outcome evidence, privacy policy, and guidance instead of creating another instrumentation fork. |
| [OpenLIT](https://docs.openlit.io/) | OpenTelemetry-native GenAI observability, auto-instrumentation, evaluation and operational dashboards | Zero-code instrumentation; LLM-as-judge hooks; standard telemetry export | Reuse adapter and observability patterns. Do not treat judge scores or request telemetry as proof of work outcome. |
| [OpenTelemetry Generative AI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai) | Emerging shared conventions for GenAI client, agent, MCP, metrics, spans, and evaluation events | Reuse operation, provider, conversation, prompt version, token usage, agent/tool, and evaluation vocabulary; support OTLP import/export | The conventions remain under development. AIwright must use a versioned internal envelope and mapping layer rather than bind persistent storage directly to unstable attribute names. |
| [OpenAI Codex](https://github.com/openai/codex) structured events and rollout trace | Structured thread/turn/item events, token usage, commands, file changes, MCP calls, plans, and opt-in local diagnostic traces | First-class Codex SDK/JSONL adapter; preserve raw observations; reduce offline into a semantic graph; distinguish model-visible content from runtime evidence | Codex is the strongest first pilot surface but must remain an adapter. Rollout traces can contain prompts, responses, terminal output, tool I/O, and paths, so they are diagnostic opt-in data, not a default managed telemetry feed. |
| Existing [AIwright](../../../README.md) | Prompt fragments, recipes, adapters, linting, scoring, user-pattern profiling, and adaptive guidance | Reuse prompt intelligence, rule vocabulary, local CLI UX, profiles, and intervention assets | Current prompt-centric scoring does not yet reconstruct live tasks, correlate artifacts/outcomes, enforce content governance, or prove that an intervention improved later work. |

## 3. What the benchmark says clearly

### 3.1 Do not build another generic trace viewer

Langfuse, Phoenix, Opik, Helicone, OpenLIT, and OpenLLMetry already cover substantial parts of model-call tracing, tokens, latency, tools, prompt versions, evaluation, and dashboards. A new product that stops at the same boundary will be a weaker clone.

AIwright Platform therefore needs a different primary object:

```text
existing observability primary object: trace / span / request
AIwright primary object:              task with expected outcome and evidence
```

Traces remain inputs to a task graph.

### 3.2 Do not invent a proprietary telemetry island

OpenTelemetry and OpenInference provide reusable instrumentation and export conventions. AIwright should:

- accept OTLP or mapped GenAI events;
- preserve provider-specific data in namespaces;
- export normalized operational telemetry;
- keep task, outcome, intervention, and coaching semantics in an AIwright-owned versioned extension;
- publish conformance fixtures for adapter authors.

### 3.3 Treat Codex as the first high-signal adapter

Codex exposes structured events for threads, turns, token usage, command execution, file changes, MCP calls, agent messages, reasoning summaries, web search, todo lists, and errors. Its local rollout trace also demonstrates the correct separation between raw observations and an offline-reduced semantic graph.

This provides enough evidence to test software-development task reconstruction without screen scraping or parsing a terminal transcript heuristically.

### 3.4 The unsolved wedge is user/work outcome intelligence

The benchmarked systems are strong at answering:

- Which model, request, prompt, trace, tool, cost, latency, or evaluator was involved?
- Did an application output pass an evaluator?
- Which prompt/model variant performed better on a dataset?

AIwright must answer:

- What task did the person intend to complete?
- Was the task contract stable or did the goal drift?
- What context did the model actually receive versus what the runtime observed?
- Which tool or artifact event changed the result?
- Was completion validated, merely claimed, or later reopened?
- Which specific user, workflow, model-route, skill, or validation intervention should change?
- Did that intervention improve a later comparable task?

### 3.5 Prompt optimization is a component, not the product

A prompt can be evaluated structurally or semantically, but its value depends on project context and outcome. AIwright's existing prompt intelligence should become one evaluator and one intervention source inside a broader task-outcome loop.

## 4. Recommended borrow/build/integrate decisions

### Borrow as design patterns

- Langfuse: asynchronous best-effort instrumentation, prompt/version linkage, human annotation.
- Phoenix/OpenInference: transparent evaluator and trace semantics, interoperability.
- Opik: failure-to-regression-dataset loop and reviewed prompt optimization.
- Helicone: gateway adapter and session/cost attribution.
- Promptfoo: configuration-driven evals and CI regression gates.
- OpenLLMetry/OpenLIT: auto-instrumentation and OTLP export.
- Codex rollout trace: append-only raw evidence plus deterministic offline reducer.

### Integrate instead of rebuilding

- Export standard traces/metrics to an existing observability backend.
- Use Promptfoo or compatible runners for selected offline/red-team eval suites.
- Accept OpenTelemetry/OpenInference instrumentation where it already exists.
- Link external trace IDs, PRs, CI checks, issues, and artifacts rather than copying every artifact body.

### Build as AIwright differentiation

- task contract and cross-session task graph;
- artifact/evidence/outcome model;
- deterministic work-pattern diagnostics;
- evidence-linked guidance contract;
- intervention application and later-effect measurement;
- private individual coaching and aggregate team diagnosis;
- content-capture modes, redaction edge, and anti-surveillance policy;
- bridge from findings into AIwright fragments/recipes, Codex workflow skills, harness modules, and evaluation datasets.

### Explicitly do not build in the MVP

- a general-purpose LLM gateway;
- a full APM replacement;
- a universal browser extension that scrapes consumer chat products;
- a high-scale distributed trace warehouse;
- an opaque personal productivity score;
- an always-on LLM judge for every turn;
- a live prompt assistant that interrupts normal work.

## 5. Competitive differentiation statement

> AIwright Platform is not the place where teams merely inspect LLM calls. It is the control plane where a person or organization can connect intent, execution, artifacts, validation, outcome, and a measured improvement action across AI tools.

The differentiation is credible only when all four conditions hold:

1. A task can span multiple traces and sessions.
2. Findings cite concrete execution or outcome evidence.
3. Recommendations can be accepted, dismissed, versioned, and measured later.
4. Privacy and organizational visibility are enforceable product behavior.

Without those conditions, AIwright Platform collapses into a prompt linter plus observability dashboard.

## 6. Reference implementation notes

### OpenTelemetry mapping

The OpenTelemetry GenAI repository defines or proposes inference-operation details, conversation identifiers, prompt name/version, model/provider, token usage, evaluation results, agent operations, and MCP conventions. AIwright should maintain:

```text
AIwright Event Envelope vN
    <-> OTel GenAI mapping package vM
    <-> provider/client adapter vK
```

This isolates internal migrations from an evolving external specification.

### Codex mapping

Initial source mappings should cover:

```text
thread.started                 -> session.started
turn.started                   -> turn.started
turn.completed + usage         -> turn.completed + usage
turn.failed                    -> turn.failed
command_execution              -> tool.invocation.*
file_change                    -> artifact.*
mcp_tool_call                  -> tool.invocation.*
agent_message                  -> message.generated
reasoning summary              -> message/runtime summary reference, never hidden CoT
web_search                     -> tool.invocation.*
todo_list                      -> run plan snapshot
rollout trace interaction edge -> agent/tool/task graph edge
```

Exact mappings belong in a versioned protocol specification and conformance fixtures, not in application UI code.

## 7. Benchmark conclusion

The open-source landscape validates the need for structured capture, trace correlation, evaluations, datasets, prompt versions, and standards. It also shows that those layers are increasingly commoditized.

AIwright should not compete by reproducing them feature for feature. It should use them as infrastructure and compete on the missing work-intelligence loop:

```text
intent -> execution -> artifact -> evidence -> outcome -> intervention -> measured effect
```
