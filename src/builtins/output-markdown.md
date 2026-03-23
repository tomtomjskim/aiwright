---
name: output-markdown
version: "0.2.0"
description: Format output as Markdown
slot: output
priority: 50
tags:
  - format
  - markdown
conflicts_with:
  - output-json
---

Always format responses using Markdown.
Use headers (##) to organize sections clearly.
Use code blocks with language tags for all code snippets.
Use bullet points for lists and bold for key terms.
Use tables when comparing multiple items.
Never output raw unformatted text for technical content.
