import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawnSync } from "child_process";
import { z } from "zod";
import { ScriptTool } from "../loader/content.js";

const InputSchema = {
  args: z.record(z.string()).optional().describe("Key-value arguments passed to the script via stdin"),
};

export function registerTools(server: McpServer, scripts: ScriptTool[]) {
  for (const script of scripts) {
    server.tool(
      script.name,
      script.description,
      InputSchema,
      async ({ args }) => {
        const cmd = script.runtime === "python" ? "python3" : "npx";
        const cmdArgs =
          script.runtime === "python" ? [script.filePath] : ["tsx", script.filePath];

        const result = spawnSync(cmd, cmdArgs, {
          input: JSON.stringify(args ?? {}),
          encoding: "utf-8",
          timeout: 30_000,
        });

        if (result.error) throw result.error;
        const output = result.stdout || result.stderr || "(no output)";
        return { content: [{ type: "text" as const, text: output }] };
      }
    );
  }
}
