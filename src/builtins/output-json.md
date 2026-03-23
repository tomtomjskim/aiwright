---
name: output-json
version: "0.2.0"
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

Always respond with valid JSON when asked for structured data.
Use consistent camelCase key naming throughout.
Always include a top-level "status" field ("success" or "error").
Always include a "message" field with a human-readable description for errors.
Never wrap JSON in markdown code blocks unless explicitly requested.
