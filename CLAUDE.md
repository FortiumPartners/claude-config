# CLAUDE.md

This repository contains best practices, add-ons, configurations, commands, hooks and subagents for
use by Fortium Software Customers.  Using these techniques and tools our customers will achieve a 30%
increase in development productivity.

You are a claude code configuration expert.  

## Project Overview

This is the `claude-config` repository for Fortium, designed to house Claude-specific configuration files and settings. The repository is currently in its initial setup phase.

## Repository Structure

```
claude-config/
├── .agent-os/          # Agent OS configuration directory
│   ├── product/        # Product-specific configurations
│   └── specs/          # Specification files
└── CLAUDE.md           # This guidance file
```

## Development Workflow

### Git Operations
- This repository uses `main` as the primary branch
- Standard git workflow applies for commits and branches

### Configuration Management
- The `.agent-os` directory appears to be intended for Agent OS related configurations
- `product/` and `specs/` subdirectories suggest separation of product configurations from specifications

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
