import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MojuloCallResult {
  content: Array<{ type: string; text?: string; data?: string }>;
  isError?: boolean;
}

/**
 * Universal client for Mojulo 3.0.0.
 * Can connect via MCP stdio protocol or directly dispatch via CLI.
 */
export class MojuloClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async connect(): Promise<void> {
    if (this.client) return;

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'mojulo'],
      env: {
        ...process.env,
        MOJULO_HOST: 'google-ai-bridge',
        MOJULO_TOOL_PACKS: 'on' // Enable drawerized packs mode
      }
    });

    this.client = new Client(
      { name: 'google-ai-bridge', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await this.client.connect(this.transport);
    console.log('Connected to Mojulo 3.0.0 MCP server over stdio');
  }

  /**
   * Invokes a tool either directly (for spine tools) or through its parent pack.
   */
  async callTool(name: string, args: Record<string, any> = {}, packId?: string): Promise<any> {
    await this.connect();
    if (!this.client) throw new Error('Client not initialized');

    if (packId && packId !== 'spine') {
      // Dispatches through pack dispatcher tool: pack_x({ tool: '...', args: { ... } })
      const result = await this.client.callTool({
        name: packId,
        arguments: {
          tool: name,
          args
        }
      });
      return this.parseResult(result);
    } else {
      // Direct spine tool call
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      return this.parseResult(result);
    }
  }

  private parseResult(result: any): any {
    if (result.content && result.content[0]?.text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return result.content[0].text;
      }
    }
    return result;
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.client = null;
      this.transport = null;
    }
  }
}

export const mojulo = new MojuloClient();