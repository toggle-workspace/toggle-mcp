# Next Steps

## 1. Set up the repo

```bash
cd /Users/aizad/Desktop/toggle-mcp
git init
npm install
```

---

## 2. Link toggle-brain content

```bash
git submodule add https://github.com/toggle-solutions/toggle-brain.git content
```

If toggle-brain's folder structure differs from the expected layout below, update
the paths in `src/loader/content.ts` before building:

```
content/
  knowledge-base/   ← .md files → MCP Resources
  skills/           ← Claude Code .md skills → MCP Prompts
  prompts/          ← prompt templates → MCP Prompts
  scripts/          ← .ts and .py files → MCP Tools
```

---

## 3. Build and connect to Claude Code

```bash
npm run build
```

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "toggle-brain": {
      "command": "node",
      "args": ["/Users/aizad/Desktop/toggle-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Code, then run `/mcp` in a session to confirm `toggle-brain` is connected.

---

## 4. Verify everything works

```bash
npm run inspect
```

Open the inspector URL (usually `http://localhost:5173`) and check:
- **Resources tab** — KB articles appear with `kb://` URIs
- **Prompts tab** — skills and templates are listed
- **Tools tab** — scripts are listed and callable

---

## 5. Set up the auto-sync workflow

1. Push this repo to `github.com/toggle-solutions/toggle-mcp`
2. Create a GitHub PAT with `repo` + `workflow` scopes
3. Add the PAT as secret `GH_PAT` in **both** repos
4. Copy `toggle-brain-notify-workflow.yml` into toggle-brain:
   ```
   .github/workflows/notify-mcp.yml
   ```

After this, every merge to toggle-brain `master` will automatically trigger a
content sync and rebuild in this repo.

---

## 6. (Later) Deploy to serverless

When you're ready to connect platforms beyond local Claude Code:

```bash
npm install -g vercel
vercel link
vercel env add TRANSPORT production   # value: http
vercel --prod
```

Your remote SSE endpoint will be at `https://<project>.vercel.app/sse`.

To auto-deploy on sync, uncomment the Vercel deploy step in
`.github/workflows/sync.yml` and add these secrets to toggle-mcp:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

## Status tracker

- [ ] Step 1 — repo initialised, `npm install` done
- [ ] Step 2 — toggle-brain submodule added, folder structure verified
- [ ] Step 3 — built and connected to Claude Code
- [ ] Step 4 — inspector verified (Resources, Prompts, Tools all populated)
- [ ] Step 5 — auto-sync workflow live in both repos
- [ ] Step 6 — deployed to Vercel (optional)
