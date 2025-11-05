# /claude-changelog Command Documentation

## Overview

The `/claude-changelog` command enables developers to track Claude updates and new features directly within Claude Code, eliminating the need for manual changelog checking and context switching.

**Time Savings**: 80% reduction (30 min/week → 6 min/week)
**Response Time**: <5 seconds for network fetch, <1 second for cache hit
**Accuracy**: ≥95% parsing and categorization accuracy

## Quick Start

```bash
# Get latest changelog
/claude-changelog

# Get specific version
/claude-changelog --version 3.5.0

# Get changes from last 7 days
/claude-changelog --since 7d

# Filter by breaking changes only
/claude-changelog --category breaking

# Get high-impact changes in JSON format
/claude-changelog --important --format json
```

## Command Syntax

```
/claude-changelog [OPTIONS]
```

## Options

### --version, -v `<version>`
Fetch changelog for a specific version.

**Format**: X.Y.Z or "latest"
**Examples**:
- `--version 3.5.0`
- `--version 3.4.2`
- `-v latest`

### --since, -s `<date|relative>`
Show changes since a specific date or relative time period.

**Formats**:
- **Date**: YYYY-MM-DD (e.g., 2025-10-01)
- **Relative**: Nd (days), Nw (weeks), Nm (months)

**Examples**:
- `--since 2025-10-01` - Since October 1st, 2025
- `--since 7d` - Last 7 days
- `--since 2w` - Last 2 weeks
- `-s 1m` - Last month

### --category, -c `<category>`
Filter changelog by feature category. Supports multiple categories (comma-separated).

**Valid Categories**:
- `breaking` - Breaking changes requiring migration
- `new` - New features and capabilities
- `enhancement` - Improvements to existing features
- `performance` - Performance optimizations
- `security` - Security updates and patches
- `deprecation` - Deprecated features
- `bugfix` - Bug fixes

**Examples**:
- `--category breaking`
- `--category breaking,new`
- `-c security`

### --important, -i
Show only high-impact changes.

**Usage**:
```bash
/claude-changelog --important
/claude-changelog -i --format json
```

### --format, -f `<format>`
Specify output format.

**Valid Formats**:
- `console` (default) - Human-readable console output with colors and symbols
- `json` - Machine-readable JSON format
- `markdown` - Markdown format for documentation

**Examples**:
- `--format console`
- `--format json`
- `-f markdown`

### --refresh, -r
Force refresh and ignore cache.

**Usage**:
```bash
/claude-changelog --refresh
/claude-changelog -r --version 3.5.0
```

**When to use**:
- Cache is stale or outdated
- Recent changes not showing
- Suspect cached data is corrupt

### --help, -h
Display help information.

**Usage**:
```bash
/claude-changelog --help
/claude-changelog -h
```

## Output Format

### Console Output (Default)

```
═══════════════════════════════════════════════════════════════
  Claude 3.5.0 Release Notes
  Released: October 15, 2025
═══════════════════════════════════════════════════════════════

🔴 BREAKING CHANGES
────────────────────────────────────────────────────────────
  • Remove Legacy Auth [HIGH IMPACT]
    Deprecated authentication methods removed
    ⚠️  Migration: Use OAuth 2.0 flow

✨ NEW FEATURES
────────────────────────────────────────────────────────────
  • Extended Context Window [HIGH IMPACT]
    Support for up to 200K tokens in API requests

⚡ PERFORMANCE IMPROVEMENTS
────────────────────────────────────────────────────────────
  • Faster Response Times
    30% reduction in latency

───────────────────────────────────────────────────────────────
Summary:
  Total Changes: 5
  Breaking: 1
  New Features: 1
  Performance: 1
  Security: 1
  Bug Fixes: 1
  High Impact: 3
───────────────────────────────────────────────────────────────
```

### JSON Output

```json
{
  "version": "3.5.0",
  "releaseDate": "2025-10-15",
  "features": [
    {
      "id": "feature-1",
      "title": "Extended Context Window",
      "category": "new",
      "impact": "high",
      "description": "Support for up to 200K tokens",
      "migrationGuidance": null,
      "confidence": 0.95
    }
  ],
  "metadata": {
    "cachedAt": "2025-11-03T10:00:00Z",
    "source": "https://docs.anthropic.com/en/release-notes/",
    "parsingConfidence": 0.95
  }
}
```

### Markdown Output

```markdown
# Claude 3.5.0

**Released:** October 15, 2025

## 🔴 Breaking Changes

- **Remove Legacy Auth** **(High Impact)**
  Deprecated authentication methods removed

  > **Migration:** Use OAuth 2.0 flow

## ✨ New Features

- **Extended Context Window** **(High Impact)**
  Support for up to 200K tokens in API requests

---

## Summary

  Total Changes: 5
  Breaking: 1
  New Features: 1
  High Impact: 3
```

## Category Symbols

- 🔴 Breaking Changes
- ✨ New Features
- 🔧 Enhancements
- ⚡ Performance Improvements
- 🔒 Security Updates
- ⚠️  Deprecations
- 🐛 Bug Fixes

## Use Cases

### Daily Standup Preparation
```bash
# Check what's new since yesterday
/claude-changelog --since 1d
```

### Sprint Planning
```bash
# Review all changes from last sprint (2 weeks)
/claude-changelog --since 2w --important
```

### Migration Planning
```bash
# Find all breaking changes
/claude-changelog --category breaking --format markdown
```

### API Integration Updates
```bash
# Get machine-readable changelog for automation
/claude-changelog --format json --version latest
```

### Security Audits
```bash
# Check recent security updates
/claude-changelog --category security --since 30d
```

## Caching Behavior

- **Cache Location**: `~/.ai-mesh/cache/changelog/`
- **Cache TTL**: 24 hours
- **Cache Strategy**: Stale-while-revalidate

**Cache Operations**:
- First run fetches from network and caches
- Subsequent runs use cache if fresh (<24 hours)
- Stale cache (>24 hours) triggers background refresh
- `--refresh` flag forces immediate network fetch

## Error Handling

The command provides helpful error messages and suggestions:

```
❌ ERROR:
Network connection failed

💡 SUGGESTION:
Check your network connection or try again later

📦 Cache fallback available - command will attempt to use cached data
```

### Common Errors

**Network Errors**:
- Connection refused → Check network
- Timeout → Retry or use cache
- DNS failure → Check URL/DNS settings

**Validation Errors**:
- Invalid version format → Use X.Y.Z (e.g., 3.5.0)
- Invalid date format → Use YYYY-MM-DD or relative (7d, 2w, 1m)
- Invalid category → See valid categories list

**Parsing Errors**:
- Parse failure → Use --refresh to fetch fresh data
- Partial results → Incomplete data displayed with warning

## Performance

- **Network fetch**: <5 seconds (p95)
- **Cache hit**: <1 second (p95)
- **Parsing accuracy**: ≥95%
- **Categorization accuracy**: ≥90%
- **Test coverage**: ≥80%

## Integration

### With CI/CD
```bash
# Check for breaking changes in pipeline
if /claude-changelog --category breaking --format json | jq '.features | length' > 0; then
  echo "Breaking changes detected - review required"
  exit 1
fi
```

### With Notification Systems
```bash
# Send daily digest
/claude-changelog --since 1d --format markdown > changelog.md
send_to_slack changelog.md
```

## Troubleshooting

### Command not found
- Verify Claude Code installation
- Check command is properly registered
- Run `/help` to see available commands

### Network timeout
- Check internet connection
- Try `--refresh` to clear cache
- Use cached version if available

### Unexpected output
- Use `--format json` for structured output
- Check category filter is correct
- Verify version format (X.Y.Z)

### Cache issues
- Clear cache: `rm -rf ~/.ai-mesh/cache/changelog/`
- Use `--refresh` to bypass cache
- Check disk space and permissions

## Support

For issues, feature requests, or questions:
- GitHub: https://github.com/FortiumPartners/claude-config/issues
- Documentation: https://github.com/FortiumPartners/claude-config/blob/main/README.md
- Use `/help` within Claude Code

## Version

This documentation is for `/claude-changelog` v1.0 (Sprint 1 MVP).

**Last Updated**: November 2025
