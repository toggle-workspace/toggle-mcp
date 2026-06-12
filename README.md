# toggle-brain MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the Toggle Brain knowledge base, prompt templates, and executable scripts to any MCP-compatible AI assistant — Claude Code, Cursor, Windsurf, and more.

---

## What it exposes

| MCP primitive | Source in `content/` | Example |
|---|---|---|
| **Resources** | `brain/`, `cockpit/`, `clients/`, `templates/`, `archive/` | `kb://brain--services--copywriting` |
| **Prompts** | `generators/`, `playbooks/` | `generators--email-sequence` |
| **Tools** | Any `.ts` or `.py` file anywhere in `content/` | `brain_scripts_audit` |

---

## Prerequisites

- Node.js 20 LTS or later
- Access to the `toggle-solutions/toggle-brain` repository (for the content submodule)

---

## Setup

### 1. Clone with submodule

```bash
git clone --recurse-submodules https://github.com/toggle-solutions/toggle-mcp.git
cd toggle-mcp
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

### 2. Install dependencies and build

```bash
npm install
npm run build
```

The compiled server lands at `dist/index.js`.

---

## Connecting to Claude Code

### Option A — CLI (recommended, project-scoped)

```bash
claude mcp add toggle-brain node /absolute/path/to/toggle-mcp/dist/index.js
```

Verify it connected:

```bash
claude mcp list
# toggle-brain: node ... - ✓ Connected
```

### Option B — Manual config (user-scoped, all projects)

Add an entry to `~/.claude.json` under the `mcpServers` key for the global scope, or use a `.mcp.json` file at the root of any project:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/absolute/path/to/toggle-mcp/dist/index.js"]
    }
  }
}
```

Then restart Claude Code or run `/mcp` in a session to reload.

### Dev mode (no build step)

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/toggle-mcp/src/index.ts"]
    }
  }
}
```

---

## Connecting to Cursor

Add to `~/.cursor/mcp.json` or via **Cursor Settings → MCP**:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/absolute/path/to/toggle-mcp/dist/index.js"]
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
      "args": ["/absolute/path/to/toggle-mcp/dist/index.js"]
    }
  }
}
```

---

## Remote / HTTP mode

Set `TRANSPORT=http` to run as an SSE server instead of stdio:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

Point any platform's MCP config at:

```
http://localhost:3000/sse
```

For deployed endpoints (e.g. Vercel), replace with your deployment URL.

---

## Usage

Once connected, the AI assistant can:

- **Browse knowledge**: ask it to read a resource like `kb://brain--services--copywriting` or "summarise the Toggle Brain positioning docs"
- **Run a prompt template**: ask it to use a prompt like `generators--email-sequence` with your variables filled in
- **Execute tools**: any `.ts` or `.py` scripts in `content/` are callable as tools — the assistant passes arguments as JSON and receives stdout back

In Claude Code you can confirm what's loaded at any time:

```
/mcp
```

---

## Verification with MCP Inspector

The official inspector gives a browser UI to browse and test all primitives:

```bash
npm run inspect
# opens http://localhost:5173
```

Check:
- **Resources tab** — all `.md` files from `brain/`, `cockpit/`, `clients/`, `templates/`, `archive/`
- **Prompts tab** — all files from `generators/` and `playbooks/`; test `{{variable}}` substitution
- **Tools tab** — all `.ts`/`.py` scripts; invoke one and confirm output

---

## Keeping content in sync

`content/` is a git submodule pointing at `toggle-solutions/toggle-brain`. To pull the latest:

```bash
git submodule update --remote --merge
npm run build
```

The CI workflow (`.github/workflows/sync.yml`) does this automatically whenever `toggle-brain` merges to master.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `toggle-brain` not in `/mcp` list | Re-run `claude mcp add ...` and restart the session |
| Resources list is empty | Run `git submodule update --init --recursive` |
| Build fails with type errors | Ensure `tsconfig.json` has `"module": "Node16"` |
| Tool execution times out | The script takes >30s — check the script directly |
| SSE endpoint returns 404 | Make sure `TRANSPORT=http` is set in the environment |
