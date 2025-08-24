# MCP Server Setup Guide

This guide walks through setting up the core MCP servers for Leo's AI-Augmented Development Process.

## Required MCP Servers

### 1. Context7 (Versioned Documentation)
Injects version-specific docs and examples directly into prompts to reduce API/versioning errors.

```bash
claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp@latest
```

### 2. Playwright MCP (Browser Automation & E2E Testing)
Provides browser automation and E2E testing capabilities as callable tools from agents.

```bash
claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest
```

**Sanity check:**
```
Use Playwright MCP to open example.com and assert the title contains 'Example'.
```

### 3. Linear (Official Remote Ticketing MCP)
Connect your preferred tracker through their MCP servers.

```bash
claude mcp add linear --scope user -- npx -y mcp-remote https://mcp.linear.app/sse
```

Follow the auth prompt (browser OAuth).

### Alternative: Atlassian (Jira/Confluence, Remote MCP)
Complete Atlassian's Remote MCP onboarding for your site, then add the provided SSE/HTTP endpoint via:
```bash
claude mcp add [name] --scope user -- [endpoint]
```

## Verification

After setup, verify all servers are connected:

```bash
claude mcp list
```

You should see:
- ✅ context7 (versioned docs)
- ✅ playwright (browser/E2E)  
- ✅ linear (or your ticketing MCP)

## Notes

- MCP configs can be scoped to `user` or `project`
- If a Desktop/GUI onboarding is available for a server, you can use it instead of CLI
- For troubleshooting remote MCP auth, remove stale auth state and re-add
- Keep tool permissions minimal by default; expand only when necessary

## Next Steps

Once MCP servers are configured:
1. Test each server with basic operations
2. Proceed to sub-agent mesh creation
3. Set up AgentOS standards