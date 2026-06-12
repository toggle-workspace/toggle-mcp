# toggle-brain MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the Toggle Brain knowledge base, prompt templates, and executable scripts to any MCP-compatible AI assistant — Claude Code, Cursor, Windsurf, and more.

Content lives in the `toggle-brain` repository and is automatically synced here on every push. You never need a GitHub token, API keys, or manual updates at runtime — just clone, build, and connect.

---

## What it exposes

| MCP primitive | Source in toggle-brain | Example |
|---|---|---|
| **Resources** | `brain/`, `cockpit/`, `clients/`, `templates/`, `archive/` | `kb://brain--services--copywriting` |
| **Prompts** | `generators/`, `playbooks/` | `generators--email-sequence` |
| **Tools** | Any `.ts` or `.py` file in the repo | `brain_scripts_audit` |

---

## Prerequisites

- Node.js 20 LTS or later

That's it. No tokens, no API keys, no external services.

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/toggle-workspace/toggle-mcp.git
cd toggle-mcp
```

### 2. Install dependencies and build

```bash
npm install
npm run build
```

### 3. Verify it works

```bash
node dist/index.js
# Loaded: 153 resources, 15 prompts, 1 tools
```

---

## Connecting to Claude Code

From inside the cloned `toggle-mcp` directory, run:

```bash
claude mcp add toggle-brain node "$(pwd)/dist/index.js"
```

Then run `/mcp` inside a Claude Code session to confirm it is connected:

```
/mcp
# toggle-brain — Connected
```

---

## Connecting to Cursor

Add to `~/.cursor/mcp.json` (or via **Cursor Settings → MCP**):

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/path/to/toggle-mcp/dist/index.js"]
    }
  }
}
```

Replace `/path/to/toggle-mcp` with the actual path where you cloned the repo.

---

## Connecting to Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/path/to/toggle-mcp/dist/index.js"]
    }
  }
}
```

Replace `/path/to/toggle-mcp` with the actual path where you cloned the repo.

---

## Remote / HTTP mode

Set `TRANSPORT=http` to run as an SSE server on a fixed port:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

Point any MCP client at `http://localhost:3000/sse`.

---

## Usage

Once connected, the AI assistant can:

- **Browse knowledge** — ask it to read resources like "summarise the Toggle Brain positioning docs" or reference `kb://brain--services--copywriting` directly
- **Run prompt templates** — ask it to use a prompt like `generators--email-sequence` with your variables filled in
- **Execute tools** — any `.ts` or `.py` scripts from toggle-brain are callable as tools

In Claude Code, confirm what is loaded at any time:

```
/mcp
```

---

## For maintainers

### How the sync works

Content in this repo is kept up to date by a two-step GitHub Actions pipeline:

1. **toggle-brain** runs `.github/workflows/notify-mcp.yml` on every push to `main`. This workflow dispatches a `repository_dispatch` event of type `toggle-brain-updated` to the `toggle-mcp` repository.
2. **toggle-mcp** has `.github/workflows/sync-brain.yml` which listens for that event, checks out toggle-brain, copies its contents into this repo, and commits and pushes the result.

The MCP server reads from the local `content/` directory at runtime — no network calls, no tokens required for end users.

### Required secret

The `toggle-brain` notify workflow needs a GitHub PAT stored as a repository secret named `GH_PAT`. This token must have:

- **repo** scope (to dispatch events to toggle-mcp)
- **workflow** scope (to trigger Actions workflows)

Add it at: `toggle-brain repo → Settings → Secrets and variables → Actions → New repository secret`

### Adding the notify workflow to toggle-brain

See `TOGGLE_BRAIN_SETUP.md` for the step-by-step guide. In short, create `.github/workflows/notify-mcp.yml` in the `toggle-brain` repository with the content from `toggle-brain-notify-workflow.yml` in this repo.

Once this is in place, every push to `toggle-brain/main` will automatically update the content in this repo within seconds.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `toggle-brain` not in `/mcp` list | Re-run `claude mcp add ...` and restart the session |
| Resources show as empty or missing | Run `git pull` to get the latest synced content, then rebuild |
| Build fails with type errors | Ensure Node.js 20 or later is installed (`node --version`) |
| Sync Action fails in toggle-brain | Check that the `GH_PAT` secret is set with `repo` and `workflow` scopes |
| Sync Action fails in toggle-mcp | Check that `sync-brain.yml` is present and the dispatch event type matches `brain-updated` |
| HTTP mode not reachable | Confirm `TRANSPORT=http` and `PORT` are set, and that the port is not blocked by a firewall |
