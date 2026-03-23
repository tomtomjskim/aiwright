# Contributing to aiwright

Thank you for your interest in contributing. This document covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Adding a New Fragment](#adding-a-new-fragment)
- [Adding a New Adapter](#adding-a-new-adapter)
- [Running Tests](#running-tests)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Style](#code-style)

---

## Development Setup

**Requirements:** Node.js 18 or later, npm 9 or later.

```bash
# Clone the repository
git clone https://github.com/tomtomjskim/aiwright.git
cd aiwright

# Install dependencies
npm ci

# Build (compiles TypeScript via tsup, outputs to dist/)
npm run build

# Watch mode for development
npm run dev

# Type-check without emitting
npx tsc --noEmit
```

After building, you can run the CLI locally:

```bash
node dist/cli.mjs --help
```

---

## Project Structure

```
src/
  schema/           # Zod schemas and TypeScript types
    fragment.ts     # FragmentSchema, SlotEnum, FragmentFile
    recipe.ts       # RecipeSchema
    score.ts        # MetricValue, ScoreResult
    manifest.ts     # ApplyManifest (tracks applied fragments)
    config.ts       # Project config (.aiwright.yml)
    profile.ts      # User profile
    index.ts        # Re-exports

  core/             # Core pipeline (resolve → load → validate → compose → render)
    resolver.ts     # Resolves fragment names to file paths (local > global > builtin)
    loader.ts       # Parses .md files with gray-matter (frontmatter + body)
    validator.ts    # Validates loaded fragments against FragmentSchema
    composer.ts     # Merges fragments by slot and priority order
    renderer.ts     # Renders Mustache templates with variable substitution
    manifest.ts     # Reads and writes apply manifests
    index.ts

  adapter/          # AI tool adapters
    contract.ts     # AdapterContract interface + shared types
    claude-code.ts  # Claude Code adapter (CLAUDE.md marker injection)
    generic.ts      # Generic adapter (stdout)
    detect.ts       # Auto-detects the best adapter for a project
    index.ts

  commands/         # CLI command handlers (one file per command)
    init.ts         # aiwright init
    add.ts          # aiwright add <fragment>
    create.ts       # aiwright create <name>
    apply.ts        # aiwright apply
    list.ts         # aiwright list
    bench.ts        # aiwright bench
    score.ts        # aiwright score
    index.ts

  scoring/          # Scoring subsystem
    heuristic.ts    # Heuristic metrics (structural_completeness, length_ratio, variable_coverage)
    user-signal.ts  # User signal metrics (thumbs up/down)
    history.ts      # Score history persistence
    index.ts

  builtins/         # Built-in fragment files shipped with the package
    system-role-engineer.md
    constraint-concise.md
    constraint-no-hallucination.md
    output-json.md
    output-markdown.md

  utils/            # Shared utilities (fs helpers, errors, etc.)
  cli.ts            # CLI entry point (commander setup)
  index.ts          # Public API re-exports

tests/
  schema/           # Schema validation tests
  core/             # Core pipeline unit tests
  adapter/          # Adapter tests
  commands/         # Command integration tests
  scoring/          # Scoring unit tests
  fixtures/         # Test data (fragments, configs, project stubs)
    fragments/
    configs/
    projects/
```

---

## Adding a New Fragment

A Fragment is a Markdown file with a YAML frontmatter block. Create one anywhere inside `.aiwright/fragments/` in your project (local scope) or `~/.aiwright/fragments/` (global scope).

### Fragment file format

```markdown
---
name: my-fragment-name        # required: lowercase, hyphens only, e.g. "output-json"
version: 0.1.0                # semver
description: One-line summary # required
slot: instruction              # system | context | instruction | constraint | output | example | custom
priority: 50                   # 0–999, higher = rendered later in the same slot
tags: [coding, typescript]
model_hint: [claude, gpt-4]
depends_on: []
conflicts_with: []
variables:
  language:
    type: string
    required: false
    default: TypeScript
    description: Target programming language
---

Always write code in {{language}}.
Follow existing project conventions.
```

### Slot semantics

| Slot          | Purpose                                      |
|---------------|----------------------------------------------|
| `system`      | Top-level persona / role assignment           |
| `context`     | Background information about the project      |
| `instruction` | Task-specific directives                      |
| `constraint`  | Hard rules the model must not violate         |
| `output`      | Output format requirements                    |
| `example`     | Worked examples                               |
| `custom`      | Free-form; use `slot_name` for disambiguation |

### Adding a built-in fragment

Place the `.md` file in `src/builtins/`, then add an integration test under `tests/core/` that verifies the fragment loads and validates successfully.

---

## Adding a New Adapter

An adapter integrates aiwright with a specific AI coding tool (Claude Code, Cursor, GitHub Copilot, etc.).

### Steps

1. Create `src/adapter/<tool-name>.ts` and implement the `AdapterContract` interface from `src/adapter/contract.ts`:

```typescript
import type { AdapterContract, ApplyResult, ComposedPrompt, DetectResult } from './contract.js';

export class MyToolAdapter implements AdapterContract {
  readonly name = 'my-tool';
  readonly description = 'Integration with My Tool';

  async detect(projectDir: string): Promise<DetectResult> {
    // Return { detected, confidence (0–1), reason }
  }

  async apply(prompt: ComposedPrompt, projectDir: string): Promise<ApplyResult> {
    // Write prompt.fullText to the tool's config file
    // Return { success, outputPaths, message, postActions? }
  }

  async read(projectDir: string): Promise<ComposedPrompt | null> {
    // Read the currently applied prompt, or return null
  }

  async remove(projectDir: string): Promise<ApplyResult> {
    // Remove the applied prompt (rollback support)
  }
}
```

2. Export the new class from `src/adapter/index.ts`.

3. Register it in `src/adapter/detect.ts` so auto-detection can pick it up.

4. Add tests under `tests/adapter/<tool-name>.test.ts`. Use the project stubs in `tests/fixtures/projects/` as the `projectDir`.

5. Document the adapter's behavior (which file it writes to, marker format if any) in the PR description.

---

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (reruns on file save)
npm run test:watch

# Coverage report (outputs to coverage/)
npm run test:coverage
```

Tests live in `tests/` and are picked up by the glob `tests/**/*.test.ts`. The test runner is [vitest](https://vitest.dev/) with `globals: true`, so `describe`, `it`, `expect`, and `vi` are available without imports.

When adding a new feature, place tests in the directory matching the source module (e.g., a test for `src/core/resolver.ts` goes in `tests/core/resolver.test.ts`). Use fixtures from `tests/fixtures/` rather than writing to the real filesystem.

---

## Commit Message Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description>

[optional body]

[optional footer: BREAKING CHANGE or issue reference]
```

### Types

| Type       | When to use                                              |
|------------|----------------------------------------------------------|
| `feat`     | A new feature visible to users or other packages         |
| `fix`      | A bug fix                                                |
| `docs`     | Documentation only                                       |
| `refactor` | Code change that neither fixes a bug nor adds a feature  |
| `test`     | Adding or updating tests                                 |
| `chore`    | Build scripts, CI config, dependency updates             |
| `perf`     | Performance improvement                                  |

### Scopes (optional but encouraged)

`schema`, `core`, `adapter`, `cli`, `scoring`, `builtins`, `docs`

### Examples

```
feat(adapter): add Cursor adapter with .cursorrules injection
fix(core): handle missing frontmatter in loader gracefully
docs: add adapter development guide to CONTRIBUTING
test(scoring): add edge cases for variable_coverage metric
chore(ci): add Node 22 to test matrix
```

---

## Pull Request Guidelines

1. **Open an issue first** for non-trivial changes so the direction can be discussed before you invest time coding.

2. **Branch from `main`** with a descriptive name: `feat/cursor-adapter`, `fix/resolver-missing-frontmatter`.

3. **Keep PRs focused.** One logical change per PR makes review faster and rollback easier.

4. **All checks must pass** before requesting review:
   - `npx tsc --noEmit` — no type errors
   - `npm test` — all tests pass
   - `npm run build` — build succeeds

5. **Write or update tests** for every changed behavior. PRs that reduce test coverage will not be merged.

6. **Update CHANGELOG.md** under `[Unreleased]` with a brief entry describing what changed.

7. Fill in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) completely, including the related issue number.

---

## Code Style

### TypeScript

- **Strict mode is mandatory.** `tsconfig.json` has `"strict": true`. Do not use `any` without a comment explaining why.
- **ESM imports.** Always include the `.js` extension on relative imports, even when the source file is `.ts`:
  ```typescript
  import { resolveFragment } from './resolver.js';
  ```
  This is required because the package is published as ESM (`"type": "module"`) and Node.js resolves by the output extension.
- **Prefer named exports** over default exports for consistency.
- **Avoid classes** unless implementing an interface (e.g., `AdapterContract`). Use plain functions and objects.

### Error handling

Throw typed errors from `src/utils/errors.ts` (`FragmentNotFoundError`, `ValidationError`, etc.) rather than generic `Error` instances. This lets callers narrow error types reliably.

### File naming

- Source files: `kebab-case.ts`
- Test files: `<source-file-name>.test.ts`
- Fragment files: `kebab-case.md`

### No formatting tooling (yet)

There is currently no Prettier or ESLint config in the repository. Follow the style of the surrounding code. A linting setup may be added in a future PR.
