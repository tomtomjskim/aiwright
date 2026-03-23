---
name: output-json
version: "0.1.0"
description: Format output as structured JSON
slot: output
priority: 50
tags:
  - format
  - json
  - structured
conflicts_with:
  - output-markdown
---

When asked for structured data, respond with valid JSON.
Use consistent key naming (camelCase).
Include a top-level "status" field ("success" or "error").
For errors, include a "message" field with a human-readable description.
