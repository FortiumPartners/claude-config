#!/bin/bash

# Create directories if they don't exist
mkdir -p ~/.claude/commands
mkdir -p ~/.claude/agents
mkdir -p ~/.claude/hooks

# Create symbolic links to the config files
ln -sf ~/partner-os/commands/* ~/.claude/commands/
ln -sf ~/partner-os/agents/* ~/.claude/agents/
ln -sf ~/partner-os/hooks/* ~/.claude/hooks/
