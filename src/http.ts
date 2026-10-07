/**
 * Streamable HTTP entry point. Stateless: each POST gets a fresh server and
 * transport, so the process holds no session state and scales horizontally.
 * This is the entry point a hosted tier (Phase 2) would use.
 */
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

export interface HttpOptions {
  port: number;
  host: string;
}

export async function startHttp(options: HttpOptions): Promise<void> {
  const app = createMcpExpressApp();

  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      process.stderr.write(`circe-mcp: ${err instanceof Error ? err.message : String(err)}\n`);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  const reject = (_req: Request, res: Response) =>
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  app.get("/mcp", reject);
  app.delete("/mcp", reject);
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  await new Promise<void>((resolve, rejectListen) => {
    app.listen(options.port, options.host, (err?: Error) => (err ? rejectListen(err) : resolve()));
  });
  process.stderr.write(`circe-mcp listening on http://${options.host}:${options.port}/mcp\n`);
}
