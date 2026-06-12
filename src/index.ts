import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./server.js";

const server = await createServer();

if (process.env.TRANSPORT === "http") {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const transport = new SSEServerTransport("/sse", app as any);
  await server.connect(transport);
  app.listen(port, () => process.stderr.write(`toggle-brain MCP listening on :${port}\n`));
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
