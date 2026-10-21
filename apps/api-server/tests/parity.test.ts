import { connect } from "node:net";
import { JwtActorResolver } from "@fb/http-api";
import { createFormModuleHandler, declareLength } from "@fb/http-api/web";
import { Database } from "@fb/server/database";
import { DatabaseTest } from "@fb/server/testing";
import { Context, Layer, ManagedRuntime } from "effect";
import { HttpServer } from "effect/http";
import { type JWTPayload, SignJWT } from "jose";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { ServerLive } from "../server.ts";

const jwt = {
  issuer: "https://host.test",
  audience: "form-module",
  secret: "a parity test secret that is long enough for HS256",
};

const sign = (claims: JWTPayload, secret = jwt.secret) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(jwt.issuer)
    .setAudience(jwt.audience)
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));

const admin = { sub: "acme-admin", tenant: "acme", capabilities: ["forms:manage"] };
const analyst = { sub: "acme-analyst", tenant: "acme", capabilities: ["responses:read"] };
const respondent = { sub: "alice", tenant: "acme", capabilities: [] };

const questionId = "0192f5a0-7c3e-7b1a-9d2e-3f4a5b6c7d8e";
const definition = {
  format: 1,
  title: "Parity",
  questions: [
    {
      id: questionId,
      type: "boolean",
      label: "Ready?",
      required: true,
      config: {},
    },
  ],
};

/** A request to the module, as either serving mode receives it. */
const request = async (
  method: string,
  path: string,
  options: { readonly claims?: JWTPayload; readonly token?: string; readonly body?: unknown } = {},
) => {
  const headers = new Headers();
  const token = options.token ?? (options.claims && (await sign(options.claims)));
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options.body === undefined ? null : JSON.stringify(options.body),
  });
};

// One database behind both modes, so a row's reply can't differ by what each mode has stored.
const server = ManagedRuntime.make(
  ServerLive({ port: 0 }).pipe(
    Layer.provide(JwtActorResolver(jwt)),
    Layer.provideMerge(DatabaseTest),
  ),
);
let port = 0;
let handler: ReturnType<typeof createFormModuleHandler>;
let publishedFormId = "";
/** Open and unlimited, so every submit to it is a new response. */
let openForm = { id: "", versionId: "" };
const replayKey = crypto.randomUUID();

beforeAll(async () => {
  const context = await server.context();
  const { address } = Context.get(context, HttpServer.HttpServer);
  if (address._tag === "UnixPathAddress") throw new Error("expected an internet address");
  port = address.port;
  handler = createFormModuleHandler({
    database: Layer.succeed(Database, Context.get(context, Database)),
    jwt,
  });

  const send = async (pending: Promise<Request>) => {
    const response = await handler.fetch(await declareLength(await pending));
    if (!response.ok) throw new Error(`seeding gave ${response.status}`);
    return response.json();
  };
  const { form, draft } = await send(
    request("POST", "/forms", { claims: admin, body: { definition } }),
  );
  await send(
    request("POST", `/forms/${form.id}/draft/publish`, {
      claims: admin,
      body: { expectedRevision: draft.revision },
    }),
  );
  publishedFormId = form.id;

  const open = await send(request("POST", "/forms", { claims: admin, body: { definition } }));
  const { version } = await send(
    request("POST", `/forms/${open.form.id}/draft/publish`, {
      claims: admin,
      body: { expectedRevision: open.draft.revision },
    }),
  );
  await send(
    request("PATCH", `/forms/${open.form.id}`, { claims: admin, body: { availability: "open" } }),
  );
  openForm = { id: open.form.id, versionId: version.id };
});

afterAll(async () => {
  await handler.dispose();
  await server.dispose();
});

interface Row {
  readonly status: number;
  readonly request: () => Promise<Request>;
  /** Sent with `Transfer-Encoding: chunked` and no `Content-Length`, which only a raw socket can do. */
  readonly chunked?: true;
  /** Creates something on each send, so the ids in its reply are compared as placeholders. */
  readonly creates?: true;
}

const rows: Record<string, Row> = {
  "an admin reads a form": {
    status: 200,
    request: () => request("GET", `/forms/${publishedFormId}`, { claims: admin }),
  },
  "no token is 401 missing": { status: 401, request: () => request("GET", "/forms") },
  "a token signed with another secret is 401 invalid": {
    status: 401,
    request: async () =>
      request("GET", "/forms", { token: await sign(admin, "another secret, also long enough") }),
  },
  "an analyst creating a form is 403": {
    status: 403,
    request: () => request("POST", "/forms", { claims: analyst, body: { definition } }),
  },
  "a respondent submits a response": {
    status: 201,
    creates: true,
    request: () =>
      request("POST", `/respond/forms/${openForm.id}/responses`, {
        claims: respondent,
        body: {
          versionId: openForm.versionId,
          answers: { [questionId]: true },
          idempotencyKey: crypto.randomUUID(),
        },
      }),
  },
  // The first send stores the response and the second replays it, so the bodies match exactly.
  "a respondent replays a submit": {
    status: 201,
    request: () =>
      request("POST", `/respond/forms/${openForm.id}/responses`, {
        claims: respondent,
        body: {
          versionId: openForm.versionId,
          answers: { [questionId]: true },
          idempotencyKey: replayKey,
        },
      }),
  },
  "an unknown form is 404": {
    status: 404,
    request: () => request("GET", `/forms/${crypto.randomUUID()}`, { claims: admin }),
  },
  "deleting a published form is 409": {
    status: 409,
    request: () =>
      request("DELETE", `/forms/${publishedFormId}?expectedRevision=stale`, { claims: admin }),
  },
  "a form id that isn't a UUID is 422": {
    status: 422,
    request: () => request("GET", "/forms/not-a-uuid", { claims: admin }),
  },
  "a chunked body is 411": {
    status: 411,
    chunked: true,
    request: () => request("POST", "/forms", { claims: admin, body: { definition } }),
  },
  "a settings body over 16 KiB is 413": {
    status: 413,
    request: () =>
      request("PATCH", `/forms/${publishedFormId}`, {
        claims: admin,
        body: { closesAt: "x".repeat(16 * 1024) },
      }),
  },
};

const reply = async (response: Response) => ({
  status: response.status,
  contentType: response.headers.get("content-type"),
  body: await response.text(),
});

const viaHandler = async ({ request, chunked }: Row) => {
  const pending = await request();
  // A transport always frames the body; only the chunked row leaves its length undeclared.
  return reply(await handler.fetch(chunked ? pending : await declareLength(pending)));
};

const viaServer = async ({ request, chunked }: Row) => {
  const pending = await request();
  const url = new URL(pending.url);
  if (chunked) return sendChunked(url.pathname + url.search, pending);
  const body = pending.body === null ? null : await pending.arrayBuffer();
  return reply(
    await fetch(`http://localhost:${port}${url.pathname}${url.search}`, {
      method: pending.method,
      headers: pending.headers,
      body,
    }),
  );
};

/** Writes the request to a raw socket with a chunked body, and reads the reply until the server closes. */
const sendChunked = async (target: string, request: Request) => {
  const body = new Uint8Array(await request.arrayBuffer());
  const head = [
    `${request.method} ${target} HTTP/1.1`,
    `host: localhost:${port}`,
    ...[...request.headers].map(([name, value]) => `${name}: ${value}`),
    "transfer-encoding: chunked",
    "connection: close",
  ].join("\r\n");
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = connect(port, "localhost", () => {
      socket.write(`${head}\r\n\r\n${body.byteLength.toString(16)}\r\n`);
      socket.write(body);
      socket.end("\r\n0\r\n\r\n");
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => resolve(Buffer.concat(chunks)));
    socket.on("error", reject);
  });
  return parseResponse(raw);
};

const parseResponse = (raw: Buffer) => {
  const split = raw.indexOf("\r\n\r\n");
  const [statusLine = "", ...fields] = raw.subarray(0, split).toString("latin1").split("\r\n");
  const headers = new Headers(
    fields.map((field) => {
      const colon = field.indexOf(":");
      return [field.slice(0, colon), field.slice(colon + 1).trim()];
    }),
  );
  const body = raw.subarray(split + 4);
  return {
    status: Number(statusLine.split(" ")[1]),
    contentType: headers.get("content-type"),
    body: (headers.get("transfer-encoding") === "chunked" ? dechunk(body) : body).toString(),
  };
};

const dechunk = (chunked: Buffer) => {
  const parts: Buffer[] = [];
  for (let at = 0; ;) {
    const lineEnd = chunked.indexOf("\r\n", at);
    const size = Number.parseInt(chunked.subarray(at, lineEnd).toString("latin1"), 16);
    if (size === 0) return Buffer.concat(parts);
    parts.push(chunked.subarray(lineEnd + 2, lineEnd + 2 + size));
    at = lineEnd + 2 + size + 2;
  }
};

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

const withIdPlaceholders = <A extends { readonly body: string }>(reply: A) => ({
  ...reply,
  body: reply.body.replaceAll(uuid, "<id>"),
});

test.each(Object.entries(rows))(
  "%s, alike from the server and the Fetch handler",
  async (_, row) => {
    const fromServer = await viaServer(row);
    const fromHandler = await viaHandler(row);
    const compared = row.creates ? withIdPlaceholders : (reply: typeof fromServer) => reply;

    expect(fromServer.status).toBe(row.status);
    expect(compared(fromHandler)).toEqual(compared(fromServer));
  },
);
