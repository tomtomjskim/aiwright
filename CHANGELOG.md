# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
