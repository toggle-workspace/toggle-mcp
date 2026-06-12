# toggle-brain MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the Toggle Brain knowledge base, prompt templates, and executable scripts to any MCP-compatible AI assistant — Claude Code, Cursor, Windsurf, and more.

Content is fetched live from the `toggle-brain` GitHub repository on startup — no submodule, no manual sync. Whenever toggle-brain is updated, restarting the server picks up the latest content automatically.

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
- A GitHub fine-grained PAT with **read-only Contents access** to `toggle-workspace/toggle-brain`

### Generating the token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Token name**: `toggle-mcp-content-read`
   - **Resource owner**: `toggle-workspace`
   - **Repository access**: Only select repositories → `toggle-brain`
   - **Permissions → Contents**: Read-only
4. Copy the token immediately after generating

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

### 3. Add your token

Create a `.env` file in the project root:

```
BRAIN_READ_TOKEN=github_pat_your_token_here
```

The `.env` file is gitignored and never committed.

### 4. Verify it works

```bash
node dist/index.js
# Fetching content from toggle-brain...
# Loaded: 153 resources, 15 prompts, 1 tools
```

---

## Connecting to Claude Code

### Option A — CLI (recommended)

```bash
claude mcp add toggle-brain node /absolute/path/to/toggle-mcp/dist/index.js
```

The server needs `BRAIN_READ_TOKEN` available when Claude Code launches it. Add it to your shell profile (`.zshrc` / `.bashrc`):

```bash
export BRAIN_READ_TOKEN=github_pat_your_token_here
```

Then reload your shell and restart Claude Code.

Verify it connected:

```bash
claude mcp list
# toggle-brain: node ... - ✓ Connected
```

### Option B — `.mcp.json` (project-scoped)

Create `.mcp.json` at the root of any project:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/absolute/path/to/toggle-mcp/dist/index.js"],
      "env": {
        "BRAIN_READ_TOKEN": "github_pat_your_token_here"
      }
    }
  }
}
```

Run `/mcp` in a Claude Code session to reload.

---

## Connecting to Cursor

Add to `~/.cursor/mcp.json` or via **Cursor Settings → MCP**:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/absolute/path/to/toggle-mcp/dist/index.js"],
      "env": {
        "BRAIN_READ_TOKEN": "github_pat_your_token_here"
      }
    }
  }
}
```

---

## Connecting to Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/absolute/path/to/toggle-mcp/dist/index.js"],
      "env": {
        "BRAIN_READ_TOKEN": "github_pat_your_token_here"
      }
    }
  }
}
```

---

## Remote / HTTP mode

Set `TRANSPORT=http` to run as an SSE server:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

Point any MCP client at `http://localhost:3000/sse`.

---

## Usage

Once connected, the AI assistant can:

- **Browse knowledge** — ask it to read resources like "summarise the Toggle Brain positioning docs" or reference `kb://brain--services--copywriting`
- **Run prompt templates** — ask it to use a prompt like `generators--email-sequence` with your variables filled in
- **Execute tools** — any `.ts` or `.py` scripts in toggle-brain are callable as tools

In Claude Code, confirm what's loaded at any time:

```
/mcp
```

---

## Getting the latest content

Content is fetched fresh from toggle-brain every time the server starts. To pick up new content, simply restart your AI assistant (or reload the MCP server).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `BRAIN_READ_TOKEN is not set` | Add the token to `.env` or your shell profile |
| `GitHub API error 401` | Token is invalid or expired — regenerate it |
| `GitHub API error 404` | Token doesn't have access to toggle-brain — check repo permissions |
| `toggle-brain` not in `/mcp` list | Re-run `claude mcp add ...` and restart the session |
| Build fails with type errors | Ensure Node.js 20+ is installed |
