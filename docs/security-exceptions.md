# Security Exception Registry

Documented, time-limited exceptions to the rules in `.claude/rules/security.md`.

An exception is a deliberate, justified deviation with compensating controls — not a note that a
rule is unmet. Genuine gaps (missing rate limiting, missing security headers) are **debt**, tracked
as GitHub issues, not entries here.

Every entry needs a review date no more than 6 months out. An expired entry is either renewed with
fresh justification or the exception is removed.

## Template

```markdown
## Exception: [Short Title]
- **Date Added:** YYYY-MM-DD
- **Rule Bypassed:** [Which rule from .claude/rules/security.md]
- **Location:** [File path(s) affected]
- **Justification:** [Business or technical reason this is necessary]
- **Mitigations:** [What safeguards are in place instead]
- **Review Date:** [YYYY-MM-DD, max 6 months out]
```

## Active exceptions

_None recorded._
