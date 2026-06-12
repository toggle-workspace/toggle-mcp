import { readFileSync } from "fs";
import { glob } from "glob";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = path.resolve(__dirname, "../../content");

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
}

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

export function loadKnowledgeBase(): KbArticle[] {
  const dir = path.join(CONTENT_ROOT, "knowledge-base");
  const files = glob.sync("**/*.md", { cwd: dir, absolute: true });
  return files.map((filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const rel = path.relative(dir, filePath);
    const slug = rel.replace(/\.md$/, "").replace(/\//g, "--");
    return { slug, title: extractTitle(content, slug), content, uri: `kb://${slug}` };
  });
}

export function loadSkillPrompts(): SkillPrompt[] {
  const skillFiles = glob.sync("**/*.md", {
    cwd: path.join(CONTENT_ROOT, "skills"),
    absolute: true,
  });
  const promptFiles = glob.sync("**/*.{md,txt}", {
    cwd: path.join(CONTENT_ROOT, "prompts"),
    absolute: true,
  });
  return [...skillFiles, ...promptFiles].map((filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const name = path.basename(filePath, path.extname(filePath))
      .replace(/\s+/g, "-")
      .toLowerCase();
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
    const name = path.basename(f, path.extname(f))
      .replace(/[\s-]+/g, "_")
      .toLowerCase();
    return { name, description: extractScriptDescription(content, runtime), filePath: f, runtime };
  });
}
