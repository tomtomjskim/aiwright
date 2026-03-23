# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
