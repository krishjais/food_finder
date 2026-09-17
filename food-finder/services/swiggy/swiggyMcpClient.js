const { getAccessToken, clearToken } = require('./swiggyOAuth');

const { extractFirstJsonValue } = require('../../utils/jsonPrefix');

const SWIGGY_MCP_FOOD_URL = process.env.SWIGGY_MCP_URL || 'https://mcp.swiggy.com/food';
const DEFAULT_TIMEOUT_MS = 15000;

class SwiggyMcpError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'SwiggyMcpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Parse MCP response supporting both standard application/json and text/event-stream (SSE)
 */
async function parseMcpResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  let rpcResponse = null;

  if (contentType.includes('text/event-stream')) {
    // Parse Server-Sent Events (SSE)
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            rpcResponse = JSON.parse(jsonStr);
          } catch (e) {
            // continue looking
          }
        }
      }
    }
  }

  if (!rpcResponse) {
    try {
      rpcResponse = JSON.parse(text);
    } catch (err) {
      throw new SwiggyMcpError(
        'Failed to parse the Swiggy MCP response',
        502,
        'PARSE_ERROR'
      );
    }
  }

  return rpcResponse;
}

/**
 * Call a tool on Swiggy Food MCP Server via streamable HTTP
 */
async function callTool(toolName, args = {}, options = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new SwiggyMcpError(
      'Swiggy authentication required. No valid access token found. Please visit /api/platforms/swiggy/auth/login to authenticate.',
      401,
      'UNAUTHORIZED'
    );
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
    id: Date.now(),
  };

  const startTime = Date.now();
  const logArgs = { ...args };
  if (logArgs.addressId) logArgs.addressId = '[redacted]';
  console.log(`[Swiggy MCP] Calling tool "${toolName}" with args:`, JSON.stringify(logArgs));

  try {
    const res = await fetch(SWIGGY_MCP_FOOD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const duration = Date.now() - startTime;
    console.log(`[Swiggy MCP] Tool "${toolName}" responded HTTP ${res.status} in ${duration}ms`);

    // Handle 401 Unauthorized / Expired session
    if (res.status === 401) {
      clearToken();
      throw new SwiggyMcpError(
        'Swiggy session expired or revoked (HTTP 401). Token cleared. Please re-authenticate via /api/platforms/swiggy/auth/login.',
        401,
        'TOKEN_EXPIRED'
      );
    }

    // Handle 429 Rate Limiting
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || '60';
      throw new SwiggyMcpError(
        `Swiggy MCP rate limit exceeded (HTTP 429). Retry after ${retryAfter} seconds.`,
        429,
        'RATE_LIMITED'
      );
    }

    if (!res.ok) {
      await res.text();
      throw new SwiggyMcpError(
        `Swiggy MCP server error (HTTP ${res.status})`,
        res.status,
        'SERVER_ERROR'
      );
    }

    const rpcResponse = await parseMcpResponse(res);

    // Check JSON-RPC protocol error
    if (rpcResponse.error) {
      const rpcErr = rpcResponse.error;
      console.error(`[Swiggy MCP] JSON-RPC error:`, rpcErr);

      if (rpcErr.code === -32001 || rpcErr.message?.includes('unauthorized') || rpcErr.message?.includes('token')) {
        clearToken();
        throw new SwiggyMcpError(
          'Swiggy session revoked or unauthorized. Please re-authenticate.',
          401,
          'TOKEN_EXPIRED'
        );
      }

      throw new SwiggyMcpError(
        rpcErr.message || 'JSON-RPC tool execution failed',
        500,
        rpcErr.code || 'RPC_ERROR'
      );
    }

    // Extract tool result
    const result = rpcResponse.result;

    if (!result) {
      return null;
    }

    // Standard MCP tools/call returns: { content: [{ type: "text", text: "..." }] }
    if (result.content && Array.isArray(result.content)) {
      const textBlock = result.content.find((c) => c.type === 'text');
      if (textBlock && textBlock.text) {
        let parsed;
        try {
          parsed = JSON.parse(textBlock.text);
        } catch {
          parsed = extractFirstJsonValue(textBlock.text);
        }

        if (parsed === null) return textBlock.text;

        if (parsed.success === false) {
          throw new SwiggyMcpError(
            parsed.error?.message || parsed.message || 'Tool indicated failure',
            400,
            'TOOL_FAILURE'
          );
        }

        return parsed.data !== undefined ? parsed.data : parsed;
      }
    }

    // Direct result object
    if (typeof result === 'object') {
      if (result.success === false) {
        throw new SwiggyMcpError(
          result.error?.message || result.message || 'Tool indicated failure',
          400,
          'TOOL_FAILURE'
        );
      }
      return result.data !== undefined ? result.data : result;
    }

    return result;
  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      console.error(`[Swiggy MCP] Request timeout after ${timeoutMs}ms for tool "${toolName}"`);
      throw new SwiggyMcpError(
        `Swiggy MCP request timed out after ${timeoutMs / 1000}s`,
        504,
        'TIMEOUT'
      );
    }

    if (err instanceof SwiggyMcpError) {
      throw err;
    }

    console.error(`[Swiggy MCP] Network error calling "${toolName}":`, err.message);
    throw new SwiggyMcpError(
      `Failed to communicate with Swiggy MCP: ${err.message}`,
      502,
      'NETWORK_ERROR'
    );
  }
}

module.exports = {
  callTool,
  SwiggyMcpError,
};
