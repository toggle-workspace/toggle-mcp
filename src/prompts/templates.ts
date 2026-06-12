import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SkillPrompt } from "../loader/content.js";

export function registerPrompts(server: McpServer, skills: SkillPrompt[]) {
  for (const skill of skills) {
    if (skill.arguments.length > 0) {
      const argsSchema = Object.fromEntries(
        skill.arguments.map((a) => [a.name, z.string().optional().describe(a.description)])
      );
      server.prompt(skill.name, skill.description, argsSchema, async (args) => {
        let text = skill.content;
        for (const [key, value] of Object.entries(args ?? {})) {
          text = text.replaceAll(`{{${key}}}`, String(value ?? ""));
        }
        return { messages: [{ role: "user", content: { type: "text", text } }] };
      });
    } else {
      server.prompt(skill.name, skill.description, async () => ({
        messages: [{ role: "user", content: { type: "text", text: skill.content } }],
      }));
    }
  }
}
