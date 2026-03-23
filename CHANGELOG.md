# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-03-23

### Added
- **Phase 3: Drift Detection + LLM-as-Judge + Self-tuning**
  - `src/intelligence/drift.ts` — Drift Detection engine with 3-level alerting
    - Warning: 3 consecutive scores < 0.5
    - Adjustment: 5 consecutive scores < 0.4
    - Deactivation: 7 consecutive scores < 0.3
    - Trend analysis: improving / stable / declining (5-window comparison)
  - `src/intelligence/llm-judge.ts` — LLM-as-Judge (simulation mode, heuristic + linter)
    - Scores prompt quality 0~1 based on lint results
    - Returns strengths, weaknesses, natural-language feedback
    - Integration point annotated for real LLM API swap (`// TODO: Replace with actual LLM API call`)
  - `src/intelligence/self-tune.ts` — Auto-tuning action generator
    - `warn`: warning-level drift notification
    - `suggest_replace`: weak fragment replacement on adjustment-level drift
    - `suggest_disable`: recipe deactivation on deactivation-level drift
    - `suggest_add`: missing constraint/example fragment injection
  - `aiwright intelligence drift [recipe]` — CLI command for drift status
  - `aiwright intelligence judge [recipe]` — CLI command for LLM-as-Judge evaluation
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
