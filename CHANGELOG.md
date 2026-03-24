# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **LLM-as-Judge**: Real LLM API integration for prompt quality evaluation
  - Anthropic Claude and OpenAI providers (direct HTTP, no SDK dependency)
  - Three modes: heuristic (free), llm, hybrid (LLM 70% + heuristic 30%)
  - SHA-256 prompt cache (7-day TTL, zero-cost repeat evaluations)
  - Daily/monthly budget management with cost estimation
  - Automatic heuristic fallback on API failure, missing key, or budget exceeded
  - Judge configuration via `aiwright.config.yaml` judge section

## [1.0.0] - 2026-03-23

### Added
- **Zero-Friction UX**: `apply` one command does everything (auto-score + auto-profile + lint + compact summary)
- **`aiwright status`**: Profile + weaknesses + drift in one screen
- **`aiwright improve [recipe]`**: Optimize + evolve + kata integrated guide
- **`aiwright hooks install/remove`**: Claude Code PreCompact hook auto-registration
- **auto-score**: heuristic(0.4) + llm-judge(0.6) blended scoring on every apply
- **compact summary**: `DNA: AW-S9E0I1 | Score: 0.82 | Lint: clean` one-line output
- **Claude Code Skills**: 6 slash commands auto-installed on init
  - `/aiwright-help`, `/aiwright-apply`, `/aiwright-status`
  - `/aiwright-improve`, `/aiwright-lint`, `/aiwright-skill-tree`
- **LLM Tool Boilerplate**: `.aiwright/tools.json` (OpenAI function calling compatible)
- **Phase 5: Combination Optimization (hill-climbing) + Dual Evolution**
  - `optimizer.ts`: Hill-climbing neighborhood search (heuristic-based, zero LLM cost; MIPROv2 조합 탐색 개념 참고)
  - `evolution.ts`: Fragment improvement suggestions (make_imperative, clarify, add_example, strengthen)
  - `aiwright intelligence optimize/evolve` CLI commands

### Changed
- `apply` output: compact 2-3 line summary (was verbose multi-line)
- `init` now auto-installs Claude Code skills + tools.json
- Claude Code adapter: writes to `.claude/CLAUDE.md` (root `CLAUDE.md` untouched)
- Built-in fragments v0.2.0 (imperative language)

## [0.5.0] - 2026-03-23

### Added
- **Phase 4: Multi-Adapter — Cursor, Copilot, Windsurf**
  - `src/adapter/cursor.ts` — CursorAdapter targeting `.cursorrules`
    - detect: `.cursorrules` → confidence 0.9, `.cursor/` directory → 0.8
    - apply: full ownership with header injection; backs up pre-existing non-managed files to `.cursorrules.backup`
    - read: returns prompt content with header stripped
    - remove: deletes managed file and restores backup if present
  - `src/adapter/copilot.ts` — CopilotAdapter targeting `.github/copilot-instructions.md`
    - detect: file presence → confidence 0.9
    - apply: auto-creates `.github/` directory; backs up to `.github/copilot-instructions.md.backup`
    - read/remove: same backup-restore pattern
  - `src/adapter/windsurf.ts` — WindsurfAdapter targeting `.windsurfrules`
    - detect: `.windsurfrules` presence → confidence 0.9
    - apply/read/remove: same pattern as CursorAdapter (`.windsurfrules.backup`)
  - All three adapters registered in `ADAPTERS` array in `detect.ts`
  - All three adapters exported from `src/adapter/index.ts`
  - 44 new tests across `cursor.test.ts`, `copilot.test.ts`, `windsurf.test.ts`

## [0.4.0] - 2026-03-23

### Added
- **Phase 3: Drift Detection + Quality Judge (heuristic simulation) + Self-tuning**
  - `src/intelligence/drift.ts` — Drift Detection engine with 3-level alerting
    - Warning: 3 consecutive scores < 0.5
    - Adjustment: 5 consecutive scores < 0.4
    - Deactivation: 7 consecutive scores < 0.3
    - Trend analysis: improving / stable / declining (5-window comparison)
  - `src/intelligence/llm-judge.ts` — Quality Judge (simulation mode, heuristic + linter; 실제 LLM API 미연동)
    - Scores prompt quality 0~1 based on lint results
    - Returns strengths, weaknesses, natural-language feedback
    - Integration point annotated for real LLM API swap (`// TODO: Replace with actual LLM API call`)
  - `src/intelligence/self-tune.ts` — Auto-tuning action generator
    - `warn`: warning-level drift notification
    - `suggest_replace`: weak fragment replacement on adjustment-level drift
    - `suggest_disable`: recipe deactivation on deactivation-level drift
    - `suggest_add`: missing constraint/example fragment injection
  - `aiwright intelligence drift [recipe]` — CLI command for drift status
  - `aiwright intelligence judge [recipe]` — CLI command for Quality Judge evaluation (simulation mode)
  - 50 new tests across drift, llm-judge, self-tune modules

## [0.2.0] - 2026-03-23

### Added
- **User Intelligence Engine (Phase 2a)**
  - 6-axis PromptStyle profiling (verbosity, specificity, context_ratio, constraint_usage, example_usage, imperative_clarity)
  - Prompt DNA code generation (`AW-R0V8S2` format — top 3 distinctive axes)
  - Weakness diagnosis (5 built-in rules with severity levels)
  - Prompt Smell Linter — 12 rules (PS001-PS012)
  - Usage event auto-collection on `apply` and `score` commands
  - `aiwright intelligence analyze|profile|reset` commands
  - `aiwright lint [recipe] [--severity]` command
- **Behavior Analysis (Phase 2b)**
  - FTRR (First-Turn Resolution Rate) metric
  - Delegation Maturity Score (Level 1-4)
  - Context Obesity detection
  - Adaptive Fragment injection (opt-in, `profile.adaptive.enabled`)
  - Growth tracking (monthly snapshots with style evolution)
  - Prompt Smell Linter extended: PS009-PS012 (behavioral patterns)

## [0.1.0] - 2026-03-23

### Added
- Fragment/Recipe data model with Zod schemas (`schema/fragment.ts`, `schema/recipe.ts`)
- Core engine: resolve → load → validate → compose → render pipeline (`core/`)
- CLI commands: `init`, `add`, `create`, `apply`, `list`, `bench`, `score`
- Claude Code adapter (CLAUDE.md marker-based injection)
- Generic adapter (stdout output)
- Scoring: User Signal + Heuristic (3 metrics)
- 5 built-in fragments (`constraint-concise`, `constraint-no-hallucination`, `output-json`, `output-markdown`, `system-role-engineer`)
- Apply manifest tracking (`manifest.ts`)
