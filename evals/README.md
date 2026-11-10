# Regression evals

This is a deterministic, offline test engine — **not AI grading**. Each case has before/after candidate copy, context, rule ID and assertions.

Allowed checks: `must_include` and `must_not_include` (case-insensitive substring), `exact` (case-sensitive text), `max_words` (integer word limit).

A case passes only if all checks pass. The system marks **regression** for before=pass/after=fail, **improvement** for before=fail/after=pass, or stable otherwise. Weighted scores are diagnostic only; they do not measure actual UX quality. No claim of semantic understanding is made.

Edit `evals/demo-suite.json` for public synthetic examples, or import private JSON through the plugin's Evals tab. Private data should not be committed to a public repository.

Example suite:

```json
{
  "id": "my-suite",
  "cases": [{
    "id": "TEST-001", "title": "Save failure", "guidelineId": "UXW-025",
    "context": "Changes could not be saved.",
    "before": "Something happened", "after": "Couldn't save changes",
    "checks": [{"id":"operation", "type":"must_include", "phrase":"save", "critical":true}]
  }]
}
```

Run `node test-evals.cjs`. The companion runs the tests locally, stores the latest report in `~/.fix-it-local/evals/latest.json`, and never uploads a suite to GitHub. Max 100 cases, 20 checks/case, 4,000 characters/candidate, 200 KB/suite.

Blind grading, automated LLM review, product-context verification and semantic evaluation are **not included** in this MVP.
