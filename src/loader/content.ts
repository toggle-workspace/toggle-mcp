import "dotenv/config";

const OWNER = "toggle-workspace";
const REPO = "toggle-brain";
const BRANCH = "main";
const BASE_URL = `https://api.github.com/repos/${OWNER}/${REPO}`;

const token = process.env.BRAIN_READ_TOKEN;
if (!token) {
  throw new Error("BRAIN_READ_TOKEN is not set. Add it to your .env file.");
}

const HEADERS: HeadersInit = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export interface KbArticle {
  slug: string;
  title: string;
  content: string;
  uri: string;
}

export interface SkillPrompt {
  name: string;
  description: string;
  content: string;
  arguments: { name: string; description: string; required: boolean }[];
}

export interface ScriptTool {
  name: string;
  description: string;
  filePath: string;
  runtime: "node" | "python";
  content: string;
}

// Folders → Resources
const KB_DIRS = ["brain", "cockpit", "clients", "templates", "archive"];
// Folders → Prompts
const PROMPT_DIRS = ["generators", "playbooks"];

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : fallback;
}

function extractDescription(content: string): string {
  const stripped = content.replace(/^---[\s\S]*?---\n?/, "").trim();
  return stripped.split("\n").find((l) => l.trim() !== "") ?? "";
}

function extractScriptDescription(content: string, runtime: "node" | "python"): string {
  const commentChar = runtime === "python" ? "#" : "//";
  const line = content.split("\n").find((l) => l.startsWith(commentChar));
  return line ? line.replace(commentChar, "").trim() : "";
}

interface GitHubTreeItem {
  path: string;
  type: string;
  url: string;
  sha: string;
}

async function fetchTree(): Promise<GitHubTreeItem[]> {
  const res = await fetch(
    `${BASE_URL}/git/trees/${BRANCH}?recursive=1`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { tree: GitHubTreeItem[] };
  return data.tree;
}

async function fetchFileContent(path: string): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/contents/${path}?ref=${BRANCH}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const data = await res.json() as { content: string; encoding: string };
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function loadKnowledgeBase(): Promise<KbArticle[]> {
  const tree = await fetchTree();
  const files = tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path.endsWith(".md") &&
      !item.path.endsWith("CLAUDE.md") &&
      KB_DIRS.some((dir) => item.path.startsWith(`${dir}/`))
  );

  return Promise.all(
    files.map(async (item) => {
      const content = await fetchFileContent(item.path);
      const dir = KB_DIRS.find((d) => item.path.startsWith(`${d}/`))!;
      const rel = item.path.slice(dir.length + 1).replace(/\.md$/, "").replace(/\//g, "--");
      const slug = `${dir}--${rel}`;
      return { slug, title: extractTitle(content, slug), content, uri: `kb://${slug}` };
    })
  );
}

export async function loadSkillPrompts(): Promise<SkillPrompt[]> {
  const tree = await fetchTree();
  const files = tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path.endsWith(".md") &&
      !item.path.endsWith("CLAUDE.md") &&
      PROMPT_DIRS.some((dir) => item.path.startsWith(`${dir}/`))
  );

  return Promise.all(
    files.map(async (item) => {
      const content = await fetchFileContent(item.path);
      const dir = PROMPT_DIRS.find((d) => item.path.startsWith(`${d}/`))!;
      const base = item.path.split("/").pop()!.replace(/\.md$/, "");
      const name = `${dir}--${base}`.replace(/\s+/g, "-").toLowerCase();
      const argMatches = [...content.matchAll(/\{\{(\w+)\}\}/g)];
      const uniqueArgs = [...new Set(argMatches.map((m) => m[1]))];
      return {
        name,
        description: extractDescription(content),
        content,
        arguments: uniqueArgs.map((a) => ({ name: a, description: a, required: false })),
      };
    })
  );
}

export async function loadScriptTools(): Promise<ScriptTool[]> {
  const tree = await fetchTree();
  const files = tree.filter(
    (item) =>
      item.type === "blob" &&
      (item.path.endsWith(".ts") || item.path.endsWith(".py"))
  );

  return Promise.all(
    files.map(async (item) => {
      const content = await fetchFileContent(item.path);
      const runtime: "node" | "python" = item.path.endsWith(".py") ? "python" : "node";
      const name = item.path
        .replace(/\.[^.]+$/, "")
        .replace(/[/\s-]+/g, "_")
        .toLowerCase();
      return {
        name,
        description: extractScriptDescription(content, runtime),
        filePath: item.path,
        runtime,
        content,
      };
    })
  );
}
