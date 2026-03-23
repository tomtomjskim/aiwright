Show all available aiwright commands and their usage.

aiwright is an AI Usage Intelligence Framework that profiles how you use AI, diagnoses weaknesses, and helps you improve.

## Daily Commands (just use these)
- `/aiwright-apply [recipe]` — Apply recipe + auto-analyze (this is the main command)
- `/aiwright-status` — View your AI usage profile at a glance

## Improvement
- `/aiwright-improve [recipe]` — Get optimization & training suggestions
- `/aiwright-lint [recipe]` — Check for prompt anti-patterns
- `/aiwright-skill-tree` — View your prompt engineering skill tree

## Setup (one-time)
```bash
aiwright init --with-builtins    # Initialize project
aiwright apply default           # Apply default recipe
aiwright hooks install           # Auto-apply on Claude Code sessions
```

## How it works
1. `aiwright apply` generates .claude/CLAUDE.md with composed prompt fragments
2. Every apply auto-scores quality, updates your profile, and shows a compact summary
3. Over time, your Prompt DNA (e.g., AW-S9E0I1) and Skill Tree evolve
4. Use `/aiwright-improve` to get personalized optimization suggestions
