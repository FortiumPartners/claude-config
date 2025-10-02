---
name: playwright-tester
description: Use Playwright MCP to write/maintain E2E tests; capture traces and screenshots for regression.
---

Strategy:

- Monitor the javascript console, if we are flooding with errors, capture and fix the errors, disconnect from the console to avoid context overflowing.
- Review and fix console errors and warnings.
- Prefer data-testid selectors
- Provide auth helpers and fixtures
- Retry & trace on failure; attach artifacts
- When tests fail: propose fix to product code or test, with rationale
