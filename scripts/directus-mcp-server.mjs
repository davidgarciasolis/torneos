#!/usr/bin/env node

const DIRECTUS_URL = (process.env.DIRECTUS_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";

const tools = [
  {
    name: "directus_request",
    description: "Make an authenticated request to the Directus REST API. Use for admin operations not covered by the other tools.",
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", enum: ["GET", "POST", "PATCH", "DELETE"] },
        path: { type: "string", description: "API path, for example /items/posts or /collections." },
        query: { type: "object", additionalProperties: true },
        body: { type: "object", additionalProperties: true }
      },
      required: ["method", "path"],
      additionalProperties: false
    }
  },
  {
    name: "directus_list_collections",
    description: "List Directus collections and their metadata.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "directus_list_items",
    description: "List items from a Directus collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        query: {
          type: "object",
          description: "Directus query parameters such as limit, fields, filter, sort, page, offset.",
          additionalProperties: true
        }
      },
      required: ["collection"],
      additionalProperties: false
    }
  },
  {
    name: "directus_get_item",
    description: "Get one item from a Directus collection by id.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
        query: { type: "object", additionalProperties: true }
      },
      required: ["collection", "id"],
      additionalProperties: false
    }
  },
  {
    name: "directus_create_item",
    description: "Create an item in a Directus collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        data: { type: "object", additionalProperties: true }
      },
      required: ["collection", "data"],
      additionalProperties: false
    }
  },
  {
    name: "directus_update_item",
    description: "Update an item in a Directus collection by id.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
        data: { type: "object", additionalProperties: true }
      },
      required: ["collection", "id", "data"],
      additionalProperties: false
    }
  },
  {
    name: "directus_delete_item",
    description: "Delete an item from a Directus collection by id.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        id: { type: "string" }
      },
      required: ["collection", "id"],
      additionalProperties: false
    }
  }
];

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!line) continue;

    try {
      await handleMessage(JSON.parse(line));
    } catch (error) {
      sendError(null, -32700, error.message);
    }
  }
});

async function handleMessage(message) {
  if (!Object.prototype.hasOwnProperty.call(message, "id")) {
    return;
  }

  try {
    switch (message.method) {
      case "initialize":
        sendResult(message.id, {
          protocolVersion: message.params?.protocolVersion || "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "directus-local", version: "1.0.0" }
        });
        break;
      case "tools/list":
        sendResult(message.id, { tools });
        break;
      case "tools/call":
        sendResult(message.id, await callTool(message.params));
        break;
      default:
        sendError(message.id, -32601, `Unsupported method: ${message.method}`);
    }
  } catch (error) {
    sendResult(message.id, {
      isError: true,
      content: [{ type: "text", text: error.message }]
    });
  }
}

async function callTool(params = {}) {
  const args = params.arguments || {};

  switch (params.name) {
    case "directus_request":
      return textResult(await directusFetch(args.method, args.path, args.query, args.body));
    case "directus_list_collections":
      return textResult(await directusFetch("GET", "/collections"));
    case "directus_list_items":
      return textResult(await directusFetch("GET", `/items/${encodeURIComponent(args.collection)}`, args.query));
    case "directus_get_item":
      return textResult(await directusFetch("GET", `/items/${encodeURIComponent(args.collection)}/${encodeURIComponent(args.id)}`, args.query));
    case "directus_create_item":
      return textResult(await directusFetch("POST", `/items/${encodeURIComponent(args.collection)}`, undefined, args.data));
    case "directus_update_item":
      return textResult(await directusFetch("PATCH", `/items/${encodeURIComponent(args.collection)}/${encodeURIComponent(args.id)}`, undefined, args.data));
    case "directus_delete_item":
      return textResult(await directusFetch("DELETE", `/items/${encodeURIComponent(args.collection)}/${encodeURIComponent(args.id)}`));
    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}

async function directusFetch(method, path, query, body) {
  if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is required.");
  if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_TOKEN is required.");
  if (!path || typeof path !== "string") throw new Error("path is required.");

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${DIRECTUS_URL}${normalizedPath}`);
  appendQuery(url.searchParams, query);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const responseText = await response.text();
  const parsed = parseJson(responseText);

  if (!response.ok) {
    throw new Error(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      response: parsed
    }, null, 2));
  }

  return parsed ?? { status: response.status, statusText: response.statusText };
}

function appendQuery(searchParams, query) {
  if (!query || typeof query !== "object") return;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object") {
      searchParams.set(key, JSON.stringify(value));
    } else {
      searchParams.set(key, String(value));
    }
  }
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function textResult(value) {
  return {
    content: [{
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
    }]
  };
}

function sendResult(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
