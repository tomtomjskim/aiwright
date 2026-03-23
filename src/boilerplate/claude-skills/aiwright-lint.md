Run the Prompt Smell Linter to check your recipe for anti-patterns (12 rules: PS001-PS012).

Run this command:
```bash
aiwright lint $ARGUMENTS
```

If no recipe name is provided, lint the default recipe.

For each finding:
1. Explain what the rule means
2. Why it matters for AI output quality
3. How to fix it (which fragment to add/modify)
