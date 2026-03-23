---
name: valid-constraint
version: 0.2.0
description: A valid constraint fragment for testing
slot: constraint
priority: 20
conflicts_with:
  - conflicting-fragment
variables:
  tone:
    type: string
    required: false
    default: formal
    description: The tone of the response
---
Always respond in a {{tone}} manner.
