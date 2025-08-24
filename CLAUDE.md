# CLAUDE.md

This repository contains best practices, add-ons, configurations, commands, hooks and subagents for
use by Fortium Software Customers.  Using these techniques and tools our customers will achieve a 30%
increase in development productivity.

You are a claude code configuration expert.  

## Project Overview

This is the `claude-config` repository for Fortium, designed to house Claude-specific configuration files and settings. The repository has established its core directory structure with initial components including Playwright testing workflows.

## Repository Structure

```
claude-config/
├── agents/             # Custom AI agents and subagent configurations
├── commands/           # Pre-built command sets and workflows
│   └── playwright-test.md  # Playwright testing automation
├── hooks/              # Automation triggers and development hooks
├── CLAUDE.md           # This guidance file
└── README.md           # Project documentation
```

## Development Workflow

### Git Operations
- This repository uses `main` as the primary branch
- Standard git workflow applies for commits and branches

### Configuration Management
- The `agents/` directory contains custom AI agents and subagent configurations
- The `commands/` directory houses pre-built command sets including Playwright testing workflows
- The `hooks/` directory is prepared for automation triggers and development hooks

## Project Context

This repository is part of the Fortium organization and is specifically focused on Claude configuration management. As development progresses, this file should be updated to include:

- Specific build commands and development scripts
- Configuration file formats and structures
- Deployment procedures
- Integration details with other Fortium systems

## Notes for Future Development

Since this is a new repository, future contributors should:
1. Update this CLAUDE.md file as the project structure evolves
2. Document any build tools, package managers, or development dependencies that get added
3. Include examples of configuration file formats once established
4. Add specific commands for testing, validation, or deployment of configurations
