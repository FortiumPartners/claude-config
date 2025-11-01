# CLI Output Format and Color Scheme Specification

**Version:** 1.0.0
**Last Updated:** October 29, 2025
**Owner:** Fortium Configuration Team

---

## Executive Summary

This document defines the complete CLI output format and color scheme for the AI Mesh command migration system. The design prioritizes clarity, professional appearance, and cross-platform compatibility while providing rich feedback during installation and migration operations.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color Palette](#color-palette)
3. [Output Components](#output-components)
4. [Message Types](#message-types)
5. [Progress Indicators](#progress-indicators)
6. [Status Reporting](#status-reporting)
7. [Cross-Platform Considerations](#cross-platform-considerations)
8. [Examples](#examples)

---

## Design Principles

### 1. Clarity First
- Information hierarchy through indentation and spacing
- Clear visual separation between sections
- Consistent formatting across all output types

### 2. Professional Appearance
- Modern, clean design inspired by industry-leading CLIs (npm, yarn, pnpm)
- Appropriate use of color and symbols
- Balanced whitespace and alignment

### 3. Accessibility
- Color is supplementary, not primary information carrier
- Symbols and text convey status alongside color
- High contrast ratios for readability
- Support for NO_COLOR environment variable

### 4. Performance
- Minimal overhead from colored output (<1ms per line)
- Efficient string concatenation and rendering
- Buffered output for large operations

---

## Color Palette

### Primary Colors (using `chalk` library)

| Color | Usage | Chalk Method | Example |
|-------|-------|--------------|---------|
| **Green** | Success, completion | `chalk.green()` | ✓ Migration completed |
| **Blue** | Information, progress | `chalk.blue()` | → Processing file... |
| **Yellow** | Warnings, skipped items | `chalk.yellow()` | ⚠ File skipped |
| **Red** | Errors, failures | `chalk.red()` | ✗ Migration failed |
| **Cyan** | Highlights, file paths | `chalk.cyan()` | `/path/to/file.md` |
| **Gray** | Dimmed, secondary info | `chalk.gray()` | (details) |
| **Magenta** | Special states, dry-run | `chalk.magenta()` | [DRY RUN] |
| **White Bold** | Headers, emphasis | `chalk.bold.white()` | **SECTION TITLE** |

### Semantic Color Mapping

```javascript
const colors = {
  // Status colors
  success: chalk.green,
  info: chalk.blue,
  warning: chalk.yellow,
  error: chalk.red,

  // Element colors
  path: chalk.cyan,
  number: chalk.yellow,
  command: chalk.magenta,
  dimmed: chalk.gray,
  emphasis: chalk.bold.white,

  // Progress colors
  progressBar: chalk.cyan,
  progressText: chalk.gray,
  percentage: chalk.bold.cyan
};
```

---

## Output Components

### 1. Headers

**Purpose**: Section titles and major operation indicators

**Format**:
```
╭─────────────────────────────────────────────────────╮
│  [OPERATION NAME]                                   │
╰─────────────────────────────────────────────────────╯
```

**Color**: Bold white for text, cyan for border

**Example**:
```javascript
console.log(chalk.cyan('╭─────────────────────────────────────────────────────╮'));
console.log(chalk.cyan('│') + '  ' + chalk.bold.white('COMMAND MIGRATION') + chalk.cyan('                                   │'));
console.log(chalk.cyan('╰─────────────────────────────────────────────────────╯'));
```

### 2. Status Icons

**Purpose**: Visual status indicators at a glance

| Symbol | Meaning | Color | Usage |
|--------|---------|-------|-------|
| ✓ | Success | Green | Completed operations |
| ✗ | Failure | Red | Failed operations |
| → | In Progress | Blue | Currently processing |
| ⚠ | Warning | Yellow | Non-critical issues |
| ℹ | Info | Blue | Informational messages |
| ⊘ | Skipped | Gray | Intentionally skipped |
| ⟳ | Rollback | Magenta | Restoration in progress |

**Format**:
```
[icon] Message text
```

### 3. File Paths

**Purpose**: Highlight file and directory references

**Format**: Cyan color with consistent indentation

**Examples**:
```
  → /Users/user/.claude/commands/plan-product.md
  ✓ /Users/user/.claude/commands/ai-mesh/plan-product.md
```

### 4. Metrics and Numbers

**Purpose**: Emphasize quantitative information

**Format**: Yellow for numbers, gray for labels

**Examples**:
```
  Files processed: 12
  Duration: 45.67ms
  Memory used: 8.23MB
```

---

## Message Types

### 1. Success Messages

**Format**:
```
✓ [Action completed] - [Optional details]
```

**Color Scheme**:
- Icon: Green
- Main text: White
- Details: Gray

**Example**:
```javascript
console.log(chalk.green('✓') + ' Migration completed ' + chalk.gray('(12 files in 45ms)'));
```

### 2. Error Messages

**Format**:
```
✗ [Error description]
  └─ [Error details or recovery action]
```

**Color Scheme**:
- Icon: Red
- Main text: Red
- Details: Gray with indentation

**Example**:
```javascript
console.log(chalk.red('✗') + ' ' + chalk.red('Failed to migrate file'));
console.log('  ' + chalk.gray('└─ Permission denied: /path/to/file.md'));
```

### 3. Warning Messages

**Format**:
```
⚠ [Warning description]
  └─ [Additional context]
```

**Color Scheme**:
- Icon: Yellow
- Main text: Yellow
- Details: Gray

**Example**:
```javascript
console.log(chalk.yellow('⚠') + ' ' + chalk.yellow('File skipped - third-party command'));
console.log('  ' + chalk.gray('└─ Source: community'));
```

### 4. Info Messages

**Format**:
```
ℹ [Information]
```

**Color Scheme**:
- Icon: Blue
- Text: White

**Example**:
```javascript
console.log(chalk.blue('ℹ') + ' Scanning existing commands...');
```

### 5. Progress Messages

**Format**:
```
→ [Current action] ([N/Total])
```

**Color Scheme**:
- Icon: Blue
- Action: White
- Counter: Gray

**Example**:
```javascript
console.log(chalk.blue('→') + ' Processing file ' + chalk.gray('(5/12)'));
```

---

## Progress Indicators

### 1. Progress Bar

**Purpose**: Visual representation of operation completion

**Library**: `cli-progress`

**Format**:
```
[████████░░░░░░░░░░] 40% | ETA: 2s | 5/12 files
```

**Configuration**:
```javascript
const progressBar = new cliProgress.SingleBar({
  format: chalk.cyan('[{bar}]') + ' {percentage}% | ETA: {eta}s | {value}/{total} files',
  barCompleteChar: '█',
  barIncompleteChar: '░',
  hideCursor: true
}, cliProgress.Presets.shades_classic);
```

**Color Scheme**:
- Bar: Cyan
- Percentage: Bold cyan
- ETA/Stats: Gray

### 2. Spinner

**Purpose**: Indicate ongoing operation without known duration

**Library**: Native implementation with setInterval

**Frames**: `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏`

**Format**:
```
⠋ [Action description]...
```

**Color**: Blue for spinner, white for text

---

## Status Reporting

### 1. Summary Report

**Purpose**: End-of-operation summary with key metrics

**Format**:
```
╭──────────────────────────────────────────╮
│  Migration Summary                       │
╰──────────────────────────────────────────╯

  ✓ Migrated:     10 files
  ⊘ Skipped:       2 files (third-party)
  ✗ Errors:        0 files
  ⏱ Duration:     45.67ms
  💾 Memory:       8.23MB

Status: SUCCESS
```

**Color Scheme**:
- Header border: Cyan
- Success icon: Green
- Skip icon: Gray
- Error icon: Red (if count > 0)
- Metrics: Yellow for numbers, white for labels
- Status: Green for SUCCESS, red for FAILURE

### 2. Error Report

**Purpose**: Detailed listing of errors encountered

**Format**:
```
╭──────────────────────────────────────────╮
│  Errors Encountered                      │
╰──────────────────────────────────────────╯

1. /path/to/file1.md
   └─ Error: YAML parsing failed
   └─ Line 5: unexpected token

2. /path/to/file2.md
   └─ Error: Permission denied

For troubleshooting, see: docs/migration-troubleshooting.md
```

**Color Scheme**:
- Header: Red border
- File paths: Cyan
- Error details: White
- Help text: Gray

### 3. Dry-Run Report

**Purpose**: Simulate migration without making changes

**Format**:
```
╭──────────────────────────────────────────╮
│  [DRY RUN] Migration Preview             │
╰──────────────────────────────────────────────╯

The following changes would be made:

  → plan-product.md
    Would move to: ai-mesh/plan-product.md

  → create-trd.md
    Would move to: ai-mesh/create-trd.md

  ⊘ custom-tool.md
    Would skip: third-party command

Total: 10 files would be migrated, 2 would be skipped

Run without --dry-run to apply these changes.
```

**Color Scheme**:
- Header: Magenta border
- [DRY RUN] badge: Bold magenta
- File operations: Blue for moves, gray for skips
- Summary: Bold white
- Help text: Gray

---

## Cross-Platform Considerations

### 1. Terminal Compatibility

**Windows**:
- Use Windows Terminal or modern terminal emulators for full color support
- Fallback to basic colors on legacy Command Prompt
- Test on PowerShell and cmd.exe

**macOS/Linux**:
- Full ANSI color support on all modern terminals
- UTF-8 symbols work on iTerm2, Terminal.app, GNOME Terminal, etc.

### 2. Color Support Detection

```javascript
const supportsColor = require('supports-color');

if (process.env.NO_COLOR || !supportsColor.stdout) {
  // Disable colors, use plain text
  chalk.level = 0;
}
```

### 3. Symbol Fallbacks

If terminal doesn't support UTF-8:

| Original | Fallback |
|----------|----------|
| ✓ | [OK] |
| ✗ | [ERROR] |
| → | > |
| ⚠ | [WARN] |
| ℹ | [INFO] |
| ⊘ | [SKIP] |

---

## Examples

### Complete Migration Flow

```
╭─────────────────────────────────────────────────────╮
│  AI Mesh Command Migration                          │
╰─────────────────────────────────────────────────────╯

ℹ Scanning existing commands...
✓ Found 12 command files

ℹ Creating ai-mesh/ subdirectory...
✓ Directory created

ℹ Migrating commands...

[████████████░░░░░░░░] 60% | ETA: 1s | 7/12 files

→ Processing plan-product.md (8/12)
✓ Migrated to ai-mesh/plan-product.md

→ Processing custom-tool.md (9/12)
⊘ Skipped - third-party command

[████████████████████] 100% | 12/12 files

✓ Migration completed

╭──────────────────────────────────────────╮
│  Migration Summary                       │
╰──────────────────────────────────────────╯

  ✓ Migrated:     10 files
  ⊘ Skipped:       2 files (third-party)
  ✗ Errors:        0 files
  ⏱ Duration:     45.67ms
  💾 Memory:       8.23MB

Status: SUCCESS ✓
```

---

## Implementation Reference

See `src/installer/cli-formatter.js` for the complete implementation of this specification.

---

## Maintenance

When updating this specification:

1. Update implementation in `cli-formatter.js`
2. Update tests in `src/__tests__/cli-formatter.test.js`
3. Capture screenshots for documentation
4. Update CHANGELOG with visual changes
5. Notify team of breaking changes to output format

---

## References

- **chalk**: https://github.com/chalk/chalk
- **cli-progress**: https://github.com/npkgz/cli-progress
- **supports-color**: https://github.com/chalk/supports-color
- **ANSI Color Codes**: https://en.wikipedia.org/wiki/ANSI_escape_code

---

**Document Status**: ✓ Complete
**Implementation Status**: Pending (Sprint 1 - TRD-010, TRD-011, TRD-012)
