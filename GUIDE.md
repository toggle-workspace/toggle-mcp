# Toggle Brain MCP Server — Implementation Guide

A step-by-step guide to building a TypeScript MCP server that surfaces all
knowledge, skills, and agents from `toggle-solutions/toggle-brain` to Claude
Code, Cursor, Windsurf, and any other MCP-compatible platform.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Scaffold the project](#2-scaffold-the-project)
3. [Set up the content directory](#3-set-up-the-content-directory)
4. [Implement the content loader](#4-implement-the-content-loader)
5. [Implement Resources (knowledge base)](#5-implement-resources-knowledge-base)
6. [Implement Prompts (skills & templates)](#6-implement-prompts-skills--templates)
7. [Implement Tools (executable scripts)](#7-implement-tools-executable-scripts)
8. [Wire up the server and transports](#8-wire-up-the-server-and-transports)
9. [Connect to Claude Code](#9-connect-to-claude-code)
10. [Connect to other platforms](#10-connect-to-other-platforms)
11. [GitHub Actions — CI and sync workflows](#11-github-actions--ci-and-sync-workflows)
12. [Deploy to serverless (Vercel)](#12-deploy-to-serverless-vercel)
13. [Verification](#13-verification)

---

## 1. Prerequisites

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| Node.js | 20 LTS | https://nodejs.org — npm 10+ is bundled |
| GitHub CLI | 2+ | `brew install gh` |

### GitHub Personal Access Token

You need a PAT with the following scopes to allow the sync workflow to
dispatch events between repositories:

- `repo` (full)
- `workflow`

Store it as a repository secret named `GH_PAT` in **both** the `toggle-brain`
repo and this (`toggle-mcp`) repo.

---

## 2. Scaffold the project

```bash
mkdir toggle-mcp && cd toggle-mcp
git init
npm init -y
```

### Install dependencies

```bash
# Runtime
npm install @modelcontextprotocol/sdk zod glob

# Optional: HTTP transport
npm install express

# Dev
npm install -D typescript tsx @types/node @types/express rimraf
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### `package.json` scripts section

```json
{
  "scripts": {
    "build": "rimraf dist && tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "inspect": "npx @modelcontextprotocol/inspector node dist/index.js"
  },
  "bin": {
    "toggle-mcp": "dist/index.js"
  }
}
```

> Commit the generated `package-lock.json` so CI can use `npm ci`.

### Directory structure to create

```
src/
  index.ts
  server.ts
  loader/
    content.ts
  resources/
    knowledge-base.ts
  tools/
    skill-runner.ts
  prompts/
    templates.ts
content/              ← populated in step 3
  knowledge-base/
  skills/
  prompts/
  scripts/
.github/
  workflows/
    ci.yml
    sync.yml
```

---

## 3. Set up the content directory

The `content/` directory is the local mirror of `toggle-brain`. You have two
options — choose one:

### Option A: Git submodule (recommended for local dev)

```bash
git submodule add https://github.com/toggle-solutions/toggle-brain.git content
git submodule update --init --recursive
```

After cloning the MCP repo elsewhere:

```bash
git submodule update --init --recursive
```

### Option B: CI copy (simpler for serverless deploys)

Skip the submodule. In the GitHub Actions sync workflow (step 11), the CI job
checks out toggle-brain and copies its contents into `content/` before
building. Nothing extra is needed locally — just create the `content/`
directory and add it to `.gitignore`.

```bash
mkdir -p content/{knowledge-base,skills,prompts,scripts}
echo "content/" >> .gitignore   # only if using Option B
```

### Expected content layout in toggle-brain

The loader assumes this structure inside the repo (adjust paths in
`src/loader/content.ts` if your repo differs):

```
knowledge-base/   ← .md files → exposed as MCP Resources
skills/           ← Claude Code .md skill files → exposed as MCP Prompts
prompts/          ← prompt template files (.md/.txt) → exposed as MCP Prompts
scripts/          ← .ts and .py executables → exposed as MCP Tools
```

---

## 4. Implement the content loader

`src/loader/content.ts` scans the `content/` directory at startup and builds
an in-memory registry used by all three primitive handlers.

```typescript
// src/loader/content.ts
import { readFileSync } from "fs";
import { glob } from "glob";
import path from "path";

export interface KbArticle {
  slug: string;        // kebab-case identifier
  title: string;       // first H1 or filename
  content: string;     // raw markdown
  uri: string;         // kb://<slug>
}

export interface SkillPrompt {
  name: string;        // filename without extension
  description: string; // first non-empty line after frontmatter
  content: string;     // full file content
  arguments: { name: string; description: string; required: boolean }[];
}

export interface ScriptTool {
  name: string;        // filename without extension, spaces → underscores
  description: string; // first comment line in the file
  filePath: string;    // absolute path
  runtime: "node" | "python";
}

const CONTENT_ROOT = path.resolve(process.cwd(), "content");

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : fallback;
}

function extractDescription(content: string): string {
  // Skip YAML frontmatter (--- ... ---), return first non-empty line
  const stripped = content.replace(/^---[\s\S]*?---\n?/, "").trim();
  return stripped.split("\n").find((l) => l.trim() !== "") ?? "";
}

function extractScriptDescription(content: string, runtime: "node" | "python"): string {
  const commentChar = runtime === "python" ? "#" : "//";
  const line = content.split("\n").find((l) => l.startsWith(commentChar));
  return line ? line.replace(commentChar, "").trim() : "";
}

export function loadKnowledgeBase(): KbArticle[] {
  const files = glob.sync("**/*.md", { cwd: path.join(CONTENT_ROOT, "knowledge-base"), absolute: true });
  return files.map((filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const rel = path.relative(path.join(CONTENT_ROOT, "knowledge-base"), filePath);
    const slug = rel.replace(/\.md$/, "").replace(/\//g, "--");
    return { slug, title: extractTitle(content, slug), content, uri: `kb://${slug}` };
  });
}

export function loadSkillPrompts(): SkillPrompt[] {
  const skillFiles = glob.sync("**/*.md", { cwd: path.join(CONTENT_ROOT, "skills"), absolute: true });
  const promptFiles = glob.sync("**/*.{md,txt}", { cwd: path.join(CONTENT_ROOT, "prompts"), absolute: true });
  return [...skillFiles, ...promptFiles].map((filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const name = path.basename(filePath, path.extname(filePath)).replace(/\s+/g, "-").toLowerCase();
    // Parse {{variable}} placeholders as prompt arguments
    const argMatches = [...content.matchAll(/\{\{(\w+)\}\}/g)];
    const uniqueArgs = [...new Set(argMatches.map((m) => m[1]))];
    return {
      name,
      description: extractDescription(content),
      content,
      arguments: uniqueArgs.map((a) => ({ name: a, description: a, required: false })),
    };
  });
}

export function loadScriptTools(): ScriptTool[] {
  const tsFiles = glob.sync("**/*.ts", { cwd: path.join(CONTENT_ROOT, "scripts"), absolute: true });
  const pyFiles = glob.sync("**/*.py", { cwd: path.join(CONTENT_ROOT, "scripts"), absolute: true });
  return [
    ...tsFiles.map((f) => ({ f, runtime: "node" as const })),
    ...pyFiles.map((f) => ({ f, runtime: "python" as const })),
  ].map(({ f, runtime }) => {
    const content = readFileSync(f, "utf-8");
    const name = path.basename(f, path.extname(f)).replace(/[\s-]+/g, "_").toLowerCase();
    return { name, description: extractScriptDescription(content, runtime), filePath: f, runtime };
  });
}
```

---

## 5. Implement Resources (knowledge base)

`src/resources/knowledge-base.ts` registers `resources/list` and
`resources/read` handlers. Each markdown article in `content/knowledge-base/`
becomes a resource with URI `kb://<slug>`.

```typescript
// src/resources/knowledge-base.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KbArticle } from "../loader/content.js";

export function registerResources(server: McpServer, articles: KbArticle[]) {
  server.resource(
    "knowledge-base",
    "kb://",
    { description: "Toggle Brain knowledge base articles" },
    async (uri) => {
      const slug = uri.href.replace("kb://", "");
      const article = articles.find((a) => a.slug === slug);
      if (!article) throw new Error(`Article not found: ${slug}`);
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: article.content }],
      };
    }
  );
}
```

> **Note:** `McpServer.resource()` in SDK v1+ accepts a URI template or a
> static prefix. Expose each article individually by iterating and registering
> one resource per article if you want them listed in `resources/list`.

For per-article registration (recommended so they appear in the list):

```typescript
export function registerResources(server: McpServer, articles: KbArticle[]) {
  for (const article of articles) {
    server.resource(
      article.slug,
      article.uri,
      { description: article.title },
      async () => ({
        contents: [{ uri: article.uri, mimeType: "text/markdown", text: article.content }],
      })
    );
  }
}
```

---

## 6. Implement Prompts (skills & templates)

`src/prompts/templates.ts` registers every `.md` skill and prompt template as
an MCP Prompt. Templates support `{{variable}}` substitution via prompt
arguments.

```typescript
// src/prompts/templates.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SkillPrompt } from "../loader/content.js";

export function registerPrompts(server: McpServer, skills: SkillPrompt[]) {
  for (const skill of skills) {
    server.prompt(
      skill.name,
      { description: skill.description, arguments: skill.arguments },
      async (args) => {
        let text = skill.content;
        // Replace {{variable}} placeholders with provided argument values
        for (const [key, value] of Object.entries(args ?? {})) {
          text = text.replaceAll(`{{${key}}}`, String(value));
        }
        return {
          messages: [{ role: "user", content: { type: "text", text } }],
        };
      }
    );
  }
}
```

---

## 7. Implement Tools (executable scripts)

`src/tools/skill-runner.ts` registers each script in `content/scripts/` as an
MCP Tool. Scripts receive their arguments as `stdin` JSON and must write their
result to `stdout`.

```typescript
// src/tools/skill-runner.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawnSync } from "child_process";
import { z } from "zod";
import { ScriptTool } from "../loader/content.js";

const InputSchema = z.object({
  args: z.record(z.string()).optional().describe("Key-value arguments passed to the script via stdin"),
});

export function registerTools(server: McpServer, scripts: ScriptTool[]) {
  for (const script of scripts) {
    server.tool(
      script.name,
      { description: script.description, inputSchema: InputSchema },
      async ({ args }) => {
        const cmd = script.runtime === "python" ? "python3" : "npx";
        const cmdArgs = script.runtime === "python" ? [script.filePath] : ["tsx", script.filePath];
        const result = spawnSync(cmd, cmdArgs, {
          input: JSON.stringify(args ?? {}),
          encoding: "utf-8",
          timeout: 30_000,
        });
        if (result.error) throw result.error;
        const output = result.stdout || result.stderr || "(no output)";
        return { content: [{ type: "text", text: output }] };
      }
    );
  }
}
```

> **Security note:** Only scripts that exist in `content/scripts/` at startup
> are registered. No dynamic execution path is accepted from the caller.

---

## 8. Wire up the server and transports

### `src/server.ts`

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadKnowledgeBase, loadSkillPrompts, loadScriptTools } from "./loader/content.js";
import { registerResources } from "./resources/knowledge-base.js";
import { registerPrompts } from "./prompts/templates.js";
import { registerTools } from "./tools/skill-runner.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "toggle-brain",
    version: "1.0.0",
  });

  const articles = loadKnowledgeBase();
  const skills = loadSkillPrompts();
  const scripts = loadScriptTools();

  registerResources(server, articles);
  registerPrompts(server, skills);
  registerTools(server, scripts);

  return server;
}
```

### `src/index.ts`

```typescript
// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const transport = new StdioServerTransport();
const server = createServer();

await server.connect(transport);
```

### Adding HTTP/SSE transport (for remote/serverless)

Set `TRANSPORT=http` and an optional `PORT` env var:

```typescript
// src/index.ts (extended)
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./server.js";

const server = createServer();

if (process.env.TRANSPORT === "http") {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const transport = new SSEServerTransport("/sse", app as any);
  await server.connect(transport);
  app.listen(port, () => console.error(`toggle-brain MCP listening on :${port}`));
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

---

## 9. Connect to Claude Code

Add the server to Claude Code's MCP configuration. You can do this globally
or per-project.

### Global (all projects)

Edit `~/.claude/settings.json`:

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

### Per-project

Edit `.claude/settings.json` in the project root (same format as above).

### Using `tsx` for development (no build step)

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

After editing, restart Claude Code or run `/mcp` in a session to reload.

---

## 10. Connect to other platforms

### Cursor

Add to `~/.cursor/mcp.json` (or Cursor Settings → MCP):

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

### Windsurf

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

### Remote HTTP endpoint (any platform)

For platforms that support HTTP/SSE MCP servers:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "url": "https://your-deployed-url.vercel.app/sse"
    }
  }
}
```

Set `TRANSPORT=http` in your deployment environment (see step 12).

---

## 11. GitHub Actions — CI and sync workflows

### `ci.yml` — build and type-check on every PR

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive   # only needed if using git submodule

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build
```

### Sync when toggle-brain merges to master

This is a two-part setup:

#### Part A — trigger in `toggle-brain` repo

Add this workflow to `toggle-solutions/toggle-brain`:

```yaml
# .github/workflows/notify-mcp.yml  (lives in toggle-brain repo)
name: Notify MCP on master merge

on:
  push:
    branches: [master, main]

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Send repository_dispatch to toggle-mcp
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer ${{ secrets.GH_PAT }}" \
            https://api.github.com/repos/toggle-solutions/toggle-mcp/dispatches \
            -d '{"event_type":"toggle-brain-updated"}'
```

> Store the PAT (with `repo` + `workflow` scopes) as secret `GH_PAT` in
> toggle-brain.

#### Part B — receiver in `toggle-mcp` repo

```yaml
# .github/workflows/sync.yml  (lives in toggle-mcp repo)
name: Sync content from toggle-brain

on:
  repository_dispatch:
    types: [toggle-brain-updated]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT }}

      # --- Option A: update submodule ---
      - name: Update submodule
        run: |
          git submodule update --remote --merge content
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add content
          git diff --staged --quiet || git commit -m "chore: sync toggle-brain content"
          git push

      # --- Option B: copy files directly (no submodule) ---
      # - uses: actions/checkout@v4
      #   with:
      #     repository: toggle-solutions/toggle-brain
      #     path: _brain
      #     token: ${{ secrets.GH_PAT }}
      # - run: |
      #     rsync -a --delete _brain/ content/
      #     rm -rf _brain

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
```

---

## 12. Deploy to serverless (Vercel)

### Install Vercel CLI and link the project

```bash
npm install -g vercel
vercel link
```

### `vercel.json`

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "functions": {
    "src/index.ts": {
      "runtime": "@vercel/node"
    }
  }
}
```

### Environment variables

```bash
vercel env add TRANSPORT production   # set value to: http
vercel env add PORT production        # set value to: 3000 (Vercel ignores this; it uses its own port)
```

### Deploy

```bash
vercel --prod
```

Your SSE endpoint will be at `https://<your-project>.vercel.app/sse`.

### Auto-deploy on sync

Extend `sync.yml` with a final step after the build:

```yaml
      - name: Deploy to Vercel
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }} --yes
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as repository
secrets in toggle-mcp.

---

## 13. Verification

### Local — MCP Inspector

The official MCP inspector gives you a visual UI to browse Resources, call
Tools, and render Prompts:

```bash
npm run build
npm run inspect
# or directly:
npx @modelcontextprotocol/inspector node dist/index.js
```

Open the URL printed in the terminal (usually `http://localhost:5173`).

What to check:
- **Resources tab**: all `.md` files from `content/knowledge-base/` should
  appear with `kb://` URIs.
- **Prompts tab**: all skill and prompt template files should be listed.
  Test argument substitution by providing values for `{{variable}}`
  placeholders.
- **Tools tab**: all scripts from `content/scripts/` should be listed. Invoke
  one and confirm the output is returned.

### Claude Code integration test

1. Add the server to `~/.claude/settings.json` (see step 9).
2. Start a new Claude Code session.
3. Run `/mcp` — `toggle-brain` should appear as connected.
4. Ask Claude to "use the toggle-brain MCP to list available skills" — it
   should enumerate your prompts.

### End-to-end sync test

1. Make a trivial change in `toggle-brain` (e.g. add a line to any KB
   article) and merge to master.
2. In the `toggle-mcp` repo, go to **Actions → Sync content from
   toggle-brain** and confirm the workflow triggered.
3. After it completes, the commit/submodule bump should appear on master.
4. If auto-deploy is configured, confirm the Vercel deployment updated.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Cannot find module '@modelcontextprotocol/sdk'` | Not installed | `pnpm install` |
| Resources list is empty | `content/knowledge-base/` is empty | Run `git submodule update --init` |
| Tool execution times out | Script takes >30 s | Increase `timeout` in `skill-runner.ts` |
| SSE endpoint returns 404 | `TRANSPORT=http` not set | Add env var in deployment settings |
| `repository_dispatch` not firing | PAT missing or wrong scope | Verify `GH_PAT` has `repo` + `workflow` |
| Type errors on build | `module` must be `Node16` | Check `tsconfig.json` matches exactly |

---

*Generated for `toggle-solutions/toggle-mcp` — TypeScript MCP server backed by `toggle-solutions/toggle-brain`.*
