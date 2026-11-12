# Feedback Analyser — Chapter 8 & 9 Learning Log

This is a **running log** for turning the Feedback Analyser into a portfolio application:
a Node.js API (Chapter 8), a React frontend (Chapter 9), and eventually an AWS deployment.

`LEARNING.md` covers Chapters 1–7 (AI engineering concepts). This file picks up from there and
focuses on **Node.js, HTTP APIs, backend architecture and AWS**. New entries are added at the end
as we build, so the file reads in the order things happened.

Each entry follows the same shape:

- **What** we did or decided
- **Why** we did it that way (and what we didn't choose)
- **How** it works, with small TypeScript examples
- **Remember** — the one or two ideas worth keeping

**Build → understand → document → move on.**

---

## Contents

1. [Where the project started (repository audit)](#1-where-the-project-started-repository-audit)
2. [How a Node.js server actually works](#2-how-a-nodejs-server-actually-works)
3. [Native `node:http` vs Express (vs Fastify)](#3-native-nodehttp-vs-express-vs-fastify)
4. [The plan for Chapter 8](#4-the-plan-for-chapter-8)
5. [Milestone 1 — the demo service and record/replay](#5-milestone-1--the-demo-service-and-recordreplay)
6. [Milestone 2a — a server with no framework](#6-milestone-2a--a-server-with-no-framework)
7. [Chapter 9 (early) — the React frontend](#7-chapter-9-early--the-react-frontend)
8. [Milestone 2b — the real API in Express 5](#8-milestone-2b--the-real-api-in-express-5)
9. [Costs: what the public demo will cost to run](#9-costs-what-the-public-demo-will-cost-to-run-phase-4-preview)
10. [Deploying on Cloudflare (instead of AWS, for now)](#10-deploying-on-cloudflare-instead-of-aws-for-now)
11. [Decisions log](#11-decisions-log)
12. [Glossary](#12-glossary)
13. [Topics to revisit](#13-topics-to-revisit)

---

## 1. Where the project started (repository audit)

### What

Before writing any server code, we inspected the repository to find out what already works and
what would break if we put it behind an HTTP API.

### What we found

The project is a **library of features plus scripts**, not yet an application:

- There's no server, no entry point and no build step. (`package.json` has
  `"main": "index.js"`, but that file doesn't exist.)
- Features are run in two ways: **Vitest tests** (with mocks) and **`*.manual.ts` scripts**
  (run with `tsx`; the Gemini ones make real API calls).
- All 158 tests pass and the typecheck is clean.

The most impressive feature is the **verified agent**, `answerWithVerifiedTools`
(`src/tools/answer-with-tools.ts`). It already uses almost everything:

```
answerWithVerifiedTools
  ├─ provider            → asks Gemini (or a mock) what to do next
  ├─ searchFeedback      → semantic search over embeddings
  ├─ getFeedbackStats    → counts records (no AI involved)
  ├─ redactPersonalData  → strips emails / UK mobile numbers
  └─ validateGroundedAnswer → Zod + quote/source/number checks
```

### Why this matters for an API

Because every dependency is **injected** (passed in as an argument), an HTTP handler only needs
to build the right dependencies and call the function. Most of the AI code can be reused
unchanged.

But four things need adapting:

| Problem | Why it matters on a server | Fix |
|---|---|---|
| `createGeminiToolProvider` keeps `let conversation = []` inside its closure | A script handles one question; a server handles many people at once. One shared provider would mix two visitors' conversations together. | Create a **new provider per request**. |
| Several files read `process.env.GEMINI_API_KEY`, some at import time | Configuration is scattered and impossible to check in one place. | One **config module**, validated once at startup. |
| Only the tool provider has timeouts/retries | A hung Gemini call would hold a request open forever. | Use `requestGemini` everywhere. |
| No shared demo dataset | The UI needs something to show. | One synthetic dataset. |

### Remember

> Code that's safe in a script isn't automatically safe on a server.
> **A script serves one user; a server serves many users at the same time, in the same process.**
> Anything stored in a module-level or long-lived variable is shared between all of them.

---

## 2. How a Node.js server actually works

Before comparing frameworks, it helps to know what every framework is built on top of.

### One process, one thread, many requests

A Node.js server is **one long-running process**. It doesn't start a new process or thread per
request (unlike, say, classic PHP). Instead it uses the **event loop**:

```
Request A arrives → handler starts → awaits Gemini (I/O) ──┐
Request B arrives → handler starts → awaits Gemini (I/O) ──┤  Node is free while waiting
Request C arrives → handler runs → responds               │
Gemini replies to A → A's handler continues → responds  ←──┘
Gemini replies to B → B's handler continues → responds
```

While a request is waiting on I/O (a network call, a file read), Node picks up other work. That's
why Node is good at APIs that mostly wait on other services — like ours, which mostly waits on
Gemini.

Two consequences:

1. **State is shared.** Requests A, B and C run in the same memory. That's why the shared
   `conversation` array above is a real bug, not a theoretical one.
2. **Blocking code blocks everyone.** A slow synchronous loop (e.g. comparing 1 million vectors)
   freezes every request, not just one. Our dataset is tiny, so this isn't a concern yet.

### What an HTTP request really is

HTTP is just text over a network connection:

```http
POST /api/questions HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 46

{"question":"What do people say about pay?"}
```

And the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"answered","summary":"..."}
```

Everything a framework does — routing, body parsing, middleware — is a convenience for
reading the first block and writing the second.

### Remember

> A Node server is **one process handling many requests concurrently** using the event loop.
> Await I/O freely; never block the thread; never keep per-user data in shared variables.

---

## 3. Native `node:http` vs Express (vs Fastify)

### What

Node comes with a built-in `node:http` module that can run a web server with no dependencies.
Express is the most widely used framework on top of it. Fastify is a newer alternative.

To compare them fairly, here's the **same two endpoints** written each way:

- `GET /api/health` → `{ "status": "ok" }`
- `POST /api/questions` → validates `{ question }` and returns an answer

### Version 1 — native `node:http`

```ts
import { createServer } from "node:http";
import { z } from "zod";

const questionSchema = z.object({ question: z.string().min(3).max(300) });

// createServer() takes ONE function. It's called for EVERY request,
// whatever the URL or method. Routing is our job.
const server = createServer(async (req, res) => {
  try {
    // 1. ROUTING — we inspect method and URL ourselves.
    if (req.method === "GET" && req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/questions") {
      // 2. BODY PARSING — the body arrives as a STREAM of chunks,
      //    not as a ready-made object. We collect the chunks ourselves...
      const chunks: Buffer[] = [];
      let size = 0;

      for await (const chunk of req) {
        size += chunk.length;
        // ...and must enforce a size limit ourselves, or someone can
        // send us a 2GB body and exhaust the server's memory.
        if (size > 10_000) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: "BODY_TOO_LARGE" } }));
          return;
        }
        chunks.push(chunk);
      }

      // 3. JSON.parse throws on invalid JSON — caught by the try/catch below.
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      // 4. VALIDATION — same Zod approach as Chapters 1–7.
      const parsed = questionSchema.safeParse(body);
      if (!parsed.success) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: "INVALID_REQUEST" } }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: parsed.data.question }));
      return;
    }

    // 5. NOTHING MATCHED → 404.
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
  } catch {
    // 6. ERROR HANDLING — without this try/catch, a thrown error inside
    //    this async function becomes an UNHANDLED PROMISE REJECTION, which
    //    crashes the whole Node process (for every user, not just this one).
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }));
  }
});

server.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

**What this teaches you:** `req` is a readable stream, `res` is a writable stream, the body has
to be assembled and size-limited by hand, routing is just `if` statements, and an uncaught error
can take the whole server down. Every framework exists to solve exactly these problems.

**The downside:** with 5–6 endpoints, URL parameters (`/api/feedback/:id`), query strings, CORS
headers and logging, this turns into a hand-written framework. That's a great exercise, but not
what you'd show an employer as your API layer.

### Version 2 — Express 5

```ts
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

const questionSchema = z.object({ question: z.string().min(3).max(300) });

const app = express();

// MIDDLEWARE — a function that runs for every request BEFORE the route.
// express.json() does everything from steps 2–3 above: collects the stream,
// enforces the size limit, parses JSON and puts the result on req.body.
app.use(express.json({ limit: "10kb" }));

// ROUTING — one line per endpoint, matched by method + path.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" }); // sets Content-Type and stringifies for us
});

app.post("/api/questions", async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_REQUEST" } });
    return;
  }

  // In Express 5, if anything in this async handler throws, the error is
  // passed to the error-handling middleware below automatically.
  // (Express 4 did NOT do this — a classic source of crashed servers.)
  res.json({ received: parsed.data.question });
});

// ERROR-HANDLING MIDDLEWARE — recognised by having FOUR parameters.
// Every unhandled error ends up here instead of crashing the process.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error); // later: a proper logger that never logs secrets
  res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
});

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

**Same behaviour, about a third of the code**, and the structure is clearer:
middleware → route → error handler.

### The request lifecycle in Express

Every request travels down a **pipeline** of functions in the order you registered them:

```
Request
  ↓
app.use(express.json())        ← middleware: parse body
  ↓
app.use(rateLimit)             ← middleware: (later) reject abusive clients
  ↓
app.post("/api/questions", …)  ← route handler: do the work, send a response
  ↓  (only if something threw, or next(error) was called)
app.use((error, req, res, next) => …)  ← error handler: safe 500 response
```

A middleware either **ends the request** (sends a response) or **calls `next()`** to pass it on.
That one idea explains almost all of Express.

### Fastify, for comparison

Fastify does the same job with more built in: schema-based validation, structured logging, an
`inject()` helper for testing without opening a port, and generally better performance. It's an
excellent choice, but you'd be learning Fastify's plugin and hook system at the same time as
Node itself.

### Comparison

| | Native `node:http` | Express 5 | Fastify |
|---|---|---|---|
| Dependencies | None | One (plus small deps) | One (plus plugins) |
| Routing | Hand-written `if`s | `app.get(path, handler)` | `app.get(path, handler)` |
| Body parsing & size limits | By hand (streams) | `express.json({ limit })` | Built in |
| Async error handling | By hand (try/catch) | Automatic (Express 5) | Automatic |
| Testing endpoints | Start a real server | `supertest` library | Built-in `inject()` |
| How common in jobs | Understanding expected | **Very common** | Growing |
| Learning value | **Highest** (shows the mechanics) | High (the industry standard) | Medium (more framework-specific) |
| Runs on AWS Lambda | With an adapter | With an adapter | With an adapter |

### Recommendation

**Do both native and Express, in that order:**

1. **A small native `node:http` server first**, as a learning exercise — one or two endpoints
   in a clearly labelled learning folder. You'll feel streams, routing and error handling
   directly.
2. **Then build the real API in Express 5.** Because you've done step 1, every Express feature
   will be "oh, that's the thing I wrote by hand", rather than magic.

Fastify is the one to skip for now. It's a good tool, but it adds framework concepts on top of
the Node fundamentals you're trying to learn, and Express is the one you're most likely to meet
in existing codebases.

### Remember

> A framework doesn't do anything you couldn't do with `node:http`.
> It gives you **routing**, **body parsing with limits**, **middleware** and **safe error
> handling** so you don't rebuild them for every project.
> In Express, every request flows through middleware in order, and each one either responds or
> calls `next()`.

---

## 4. The plan for Chapter 8

The public demo will start in **replay mode**: Gemini is called once, offline, for a small
synthetic dataset and a handful of example questions. Those responses are saved as JSON and
replayed through the **real** pipeline — real tool execution, redaction, Zod validation and
grounding checks. Visitors get a genuine working demo, with no ongoing AI cost or abuse risk.
A rate-limited "live" mode can be added later, switched off by default.

| Milestone | What | Cost |
|---|---|---|
| 1 | Synthetic dataset + demo service (business logic, no HTTP) + replay provider | £0 |
| 2a | Learning exercise: tiny native `node:http` server | £0 |
| 2b | Real API in Express 5, with Zod validation, consistent errors, config module, endpoint tests | £0 |
| 3 | One-off script to record real Gemini responses (needs approval first) | A few dozen Gemini calls, once |
| Later | React frontend → GitHub Actions → AWS design & cost review → deploy | Reviewed before each step |

## 5. Milestone 1 — the demo service and record/replay

### What

We built `src/demo/`: a **service** that runs the public demo using a synthetic dataset and
**recorded** AI responses, with no Gemini calls. It has no HTTP code yet; Milestone 2 puts an
API on top of it.

```ts
const service = await createReplayDemoService();

await service.askQuestion("What do employees say about their managers?");
// → { outcome: "verified", answer: {...}, toolCalls: [{ name: "searchFeedback", ... }] }
```

Six example questions cover every state the UI needs to show:

| Example | Outcome |
|---|---|
| Workload + count | ✅ answered, with a verified number |
| Managers | ✅ answered (one source has its email and phone number redacted) |
| Leadership communication | ✅ answered, with positive and negative evidence |
| Canteen food | ✅ insufficient evidence (nothing in the data mentions it) |
| Flexible working | ❌ rejected: **deliberately faulty** recording invents a quote |
| Comment count | ❌ rejected: **deliberately faulty** recording claims 30 instead of 24 |

### Why record/replay?

A public demo that calls Gemini on every click costs money and can be abused. A demo of
hard-coded results would be dishonest. Record/replay sits in between:

```
                     LIVE                       REPLAY
Gemini's replies     fetched over the network   read from a recording
Tools                run for real               run for real
Redaction            runs for real              runs for real
Zod + grounding      runs for real              runs for real
```

The trick is that the agent talks to an **interface**, `StructuredToolProvider`, so it can't
tell a Gemini provider from a replay provider. That's the dependency injection from Chapter 1
paying off: we changed where the answers come from without touching the agent.

The recordings are hand-written placeholders for now. Milestone 3 records real ones.

### How — five ideas worth understanding

#### 1. Shared read-only state vs per-request state

The server creates the service **once** and every visitor's request uses it. So:

```ts
// Created ONCE at startup, shared by every request. Safe, because it's never modified.
const searchFeedback = createSearchFeedbackTool({ feedback: preparedFeedback, embeddingProvider });

async askQuestion(question) {
  // Created FRESH for every request, because it changes as the conversation runs.
  const replayProvider = createReplayToolProvider(recording); // tracks its position
  ...
}
```

The test `handles concurrent questions independently` fires three questions with
`Promise.all`. Their steps interleave on the event loop, exactly like three simultaneous
visitors, and each still gets the right answer.

We also hand out `structuredClone(response)` instead of the recorded object itself. Otherwise
one request could modify data that the next request reads.

#### 2. The decorator pattern

We wanted to show visitors which tools the agent called, without changing the well-tested agent.
A **decorator** wraps an object, keeps the same interface, and adds behaviour:

```ts
const traced: StructuredToolProvider = {
  askQuestion: async (q) => record(await inner.askQuestion(q)),
  submitToolResult: async (r) => record(await inner.submitToolResult(r)),
};
```

The agent receives `traced` and has no idea anything changed. `createCachedEmbeddingProvider`
from Chapter 3 is the same pattern.

#### 3. Custom error classes and `instanceof`

Grounding failures used to be `new Error("Grounding verification failed: ...")`. To react to
them, you'd have to check the message text, which breaks silently if someone rewords it. We
added a class:

```ts
export class GroundingVerificationError extends Error { ... }

if (error instanceof GroundingVerificationError) { /* expected: show the visitor */ }
```

The message text is identical, so all 158 existing tests still passed unchanged.

#### 4. Expected failures are results; unexpected failures are throws

| Situation | What the service does | Why |
|---|---|---|
| AI answer fails grounding | **returns** `{ outcome: "rejected", reason }` | Expected, and showing it is part of the demo |
| Unknown feedback ID / question | **throws** `DemoServiceError` with a `code` | The caller asked for something that doesn't exist |
| A recording is broken, or a bug | **re-throws** the original error | Unexpected: should become a generic 500 |

The service never mentions HTTP status codes. It says **what** went wrong
(`FEEDBACK_NOT_FOUND`); the HTTP layer will decide **how** to report it (404). Keeping that
separation is what lets the same service run behind Express, Lambda or a test.

#### 5. Fail fast at startup

```ts
for (const item of data.feedback) {
  if (data.analyses[item.id] === undefined) {
    throw new Error(`Demo data is incomplete: no recorded analysis for ${item.id}.`);
  }
}
```

A server that refuses to start with a clear message is much easier to debug than one that
starts happily and breaks on a visitor's first click.

### TypeScript details used

- **`as const satisfies readonly SearchableFeedback[]`** checks the dataset's shape while
  keeping the exact IDs, so `type DemoFeedbackId = "fb-001" | ... | "fb-024"`.
- **`Record<DemoFeedbackId, number[]>`** makes the compiler insist that every comment has an
  embedding.
- **`Awaited<ReturnType<StructuredToolProvider["askQuestion"]>>`** derives the response type from
  the existing interface, instead of copying it.
- **Discriminated unions:** checking `result.outcome === "verified"` narrows the type so
  `result.answer` becomes available.

### Remember

> **Only record what's external; run everything else for real.** That keeps a replay demo honest.
> **Shared read-only data is fine; shared mutable data mixes users up.** Create per-conversation
> objects per request.
> **Services describe what went wrong; the HTTP layer decides how to say it.**

---

## 6. Milestone 2a — a server with no framework

### What

`src/server/learning/native-http-server.ts` puts the demo service behind a real HTTP API using
only Node's built-in `node:http`. It's a **learning exercise**: the real API (Milestone 2b) uses
Express. Run it with:

```bash
npm run learn:native-server
```

```bash
curl http://localhost:3000/api/health
```

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{ "status": "ok" }` |
| `GET /api/feedback` | The 24 redacted comments |
| `GET /api/feedback/:id/analysis` | One comment's analysis, or 404 |
| `GET /api/questions/examples` | The 6 example questions |
| `POST /api/questions` `{ "question": "..." }` | The demo service's result |

Every error has the same shape, so the frontend handles them all in one place:

```json
{ "error": { "code": "BODY_TOO_LARGE", "message": "Request body is too large." } }
```

### Why do it by hand first?

To see each job a framework does. Here's what it took, and the Express line that replaces it:

| Job | By hand in `node:http` | In Express |
|---|---|---|
| Routing | `if (method === "GET" && pathname === "/api/health")` | `app.get("/api/health", ...)` |
| URL parameters | Regex `/^\/api\/feedback\/([^/]+)\/analysis$/` + `decodeURIComponent` | `"/api/feedback/:id/analysis"` → `req.params.id` |
| Reading the body | `for await (const chunk of req)`, then `Buffer.concat`, then `JSON.parse` | `express.json()` |
| Size limit | Check `Content-Length`, **and** count bytes as they arrive | `express.json({ limit: "10kb" })` |
| JSON-only bodies | Check `Content-Type`, return 415 | `express.json()` skips non-JSON bodies |
| Sending JSON | `statusCode`, `setHeader` ×2, `end` | `res.status(200).json(body)` |
| Error handling | One big `try/catch` around every route | Error-handling middleware |
| Logging | `res.on("finish", ...)` | A logging middleware |

### How — the ideas worth keeping

#### 1. The request body is a stream

The body arrives in **chunks**, at the network's pace. You collect them, then decode:

```ts
const chunks: Buffer[] = [];
for await (const chunk of req) chunks.push(chunk);
const text = Buffer.concat(chunks).toString("utf8"); // join FIRST, then decode
```

Joining before decoding matters: a two-byte character such as "é" can be split across two
chunks, and decoding the halves separately would corrupt it.

#### 2. Never trust `Content-Length` alone

We check the header (cheap: refuse before reading anything) **and** count the real bytes,
because the header is optional and a client can lie. curl tests showed both paths return 413,
including a chunked upload with no `Content-Length` at all.

#### 3. One uncaught error can take down every user

The request handler is `async`. If it throws and nothing catches it, the promise rejects with no
handler, and modern Node **crashes the process** on unhandled rejections. That's why the whole
handler sits inside one `try/catch`, which sorts errors into three groups:

```
HttpError          → we raised it on purpose; its message is safe to show
DemoServiceError   → translate the code: FEEDBACK_NOT_FOUND → 404, QUESTION_NOT_AVAILABLE → 422
anything else      → log details on the server; send a generic 500 to the client
```

A test throws `new Error("database password is hunter2")` inside the service and checks that the
response is a generic 500 that doesn't contain "hunter2".

#### 4. Status codes say whose fault it is

| Code | Meaning | Used when |
|---|---|---|
| 200 | OK | Success, **including** a "rejected" answer, because the request worked and the result is valid |
| 400 | Bad Request | Malformed JSON, missing or invalid question |
| 404 | Not Found | Unknown route or feedback ID |
| 413 | Content Too Large | Body over 10 KB |
| 415 | Unsupported Media Type | Body isn't JSON |
| 422 | Unprocessable Content | Valid request, but not one of the example questions |
| 500 | Internal Server Error | A bug; details stay in the server logs |

A **rejected answer is a 200**. The HTTP request succeeded; it's the AI's answer that failed
verification, and that's information for the UI to show, not an error in the request.

#### 5. Create, then start: the composition root

`native-http-server.ts` only **creates** a server from the dependencies it's given.
`start-native-server.ts` is the **entry point**: it reads `PORT`, builds the real service, and
calls `listen()`. Tests can then run the server on **port 0**, which asks the operating system
for any free port, so they never clash with anything else.

#### 6. Graceful shutdown

```ts
process.on("SIGTERM", () => server.close(() => process.exit(0)));
```

`close()` stops accepting new connections but lets in-progress requests finish. Hosting
platforms send `SIGTERM` before stopping a server, and Ctrl+C sends `SIGINT`. Without this, a
deploy could cut off a visitor's request halfway through.

### Remember

> A framework is **routing + body parsing with limits + middleware + safe error handling**.
> You've now written each of those by hand.
> **Catch everything in a request handler**: in Node, one unhandled rejection crashes the server
> for everyone.
> **Status codes describe the HTTP request, not the AI's answer.** A rejected answer is still a
> 200.

---

## 7. Chapter 9 (early) — the React frontend

### What

`web/` is the demo's UI: React + TypeScript + Vite, with plain CSS. It shows the example questions,
verified answers with their sources, rejected answers with the validator's reason, and every
comment with on-demand analysis. Run it with two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Then open http://localhost:5173.

We built the frontend **before** the Express API (Milestone 2b) so there's something to show
sooner. The Express API will have identical endpoints, so the frontend won't change.

You already know React, so this entry focuses on how the frontend and backend fit together.

### How — the integration ideas worth keeping

#### 1. One origin, everywhere: the dev proxy

The frontend only calls relative URLs: `fetch("/api/feedback")`.

```
Development:  browser → Vite :5173 ──/api/*──► Node API :3000
Production:   browser → CloudFront ──/api/*──► backend
                                   └─ else ──► static files in S3
```

Because the browser only ever talks to one origin, **CORS never comes up**. If the app called
`http://localhost:3000` directly, a different port would count as a different origin, and we'd need
CORS headers on the API. And remember: CORS is a browser rule, not security. It doesn't stop
curl, scripts or bots.

#### 2. `fetch` doesn't reject on HTTP errors

```ts
const response = await fetch("/api/feedback/fb-999/analysis");
response.ok;     // false
response.status; // 404, yet fetch did NOT throw
```

`fetch` only rejects when the network fails. Forgetting to check `response.ok` is one of the most
common frontend bugs. `api/client.ts` handles it in one place and turns every failure into an
`ApiError` with a `code` and a human-readable `message`.

That works neatly because the API returns **one error shape** for everything (a decision from
Milestone 2a), so one `ErrorMessage` component handles every error in the UI.

#### 3. Race conditions and cancellation

Click question A, then quickly question B. If A's response arrives last, it overwrites B's
answer. `useAsyncTask` prevents that: each new run calls `abort()` on the previous request's
`AbortController`, and an aborted run never updates state.

```ts
controllerRef.current?.abort();             // cancel the old request
const controller = new AbortController();
const data = await task(controller.signal); // fetch(url, { signal })
if (!controller.signal.aborted) setState({ status: "success", data });
```

It's the same idea as the backend's per-request state: each conversation's data belongs only to
that conversation.

#### 4. Sharing types without sharing code

```ts
import type { QuestionResult } from "../../../src/demo/demo-service";
```

`import type` is erased at build time, so the frontend gets the backend's exact types with
**none** of its code in the browser bundle. We checked: the built JavaScript contains no Zod and no
agent code. If the backend changes a response shape, the frontend's type check fails straight
away.

#### 5. Production React is just files

`npm run build:web` produces `web/dist/`: one HTML file, one JS file and one CSS file. There's no
server involved, which is why S3 + CloudFront can host it for pennies (Phase 4).

### Accessibility, built in rather than added later

- `aria-live="polite"` on the answer area: screen readers announce new answers.
- `role="alert"` on errors and `role="status"` on loading messages.
- `aria-pressed` on the selected example question.
- Source links are plain `href="#fb-003"` anchors, highlighted with CSS `:target`, so they work
  with no JavaScript, from the keyboard, and with screen readers.
- `<details>` for the collapsible agent steps, which is keyboard accessible by default.
- A visible `:focus-visible` ring, dark mode via `prefers-color-scheme`, smooth scrolling only if
  the user hasn't asked for reduced motion.

A screenshot check on an iPhone-sized screen found that the answer appeared below six buttons,
off screen. The fix scrolls it into view with `scrollIntoView({ block: "nearest" })`, which does
nothing when the answer is already visible.

### Remember

> **Same origin = no CORS.** Proxy `/api` in development and route it in CloudFront in
> production.
> **Check `response.ok`:** `fetch` only throws on network failure.
> **Cancel stale requests**, or a slow old response can overwrite a new one.
> **`import type` shares the contract, not the code.**

---

## 8. Milestone 2b — the real API in Express 5

### What

`src/server/` now holds the real API, built with Express 5. It has the **same endpoints, the same
responses and the same error shape** as the native learning server, which stays in
`src/server/learning/` for comparison. The frontend switched over with no changes.

```bash
npm run dev:api
```

That starts Express. To run the learning server instead:

```bash
npm run learn:native-server
```

| File | Job | Native equivalent |
|---|---|---|
| `app.ts` | Middleware order: logger → JSON parser → routes → 404 → errors | The request listener |
| `routes.ts` | One line per endpoint; thin handlers that call the service | `route()` with its `if`s and regex |
| `http-errors.ts` | `HttpError`, error-handling middleware, 404 handler | The `catch` block |
| `request-logger.ts` | Logging middleware | `res.on("finish")` at the top |
| `start-server.ts` | Composition root: build the service, `listen`, graceful shutdown | `start-native-server.ts` |

### Why — and an honest comparison

Code lines (comments and blanks removed): native **134**, Express **124**. That's less of a
difference than you might expect, and it's worth knowing why:

- **What Express removed:** streams, chunk collection, byte counting, `Content-Length` and
  `Content-Type` headers, URL parsing, the regex for `:id`, `decodeURIComponent`, and the
  if-chain router. That's the *plumbing*, and it's where the bugs hide.
- **What stayed:** deciding that `FEEDBACK_NOT_FOUND` is a 404, writing the Zod schema, choosing a
  safe error message, choosing what to log. Those are *your application's decisions*, and no
  framework can make them for you.

The Express version is also easier to extend. Adding an endpoint is one `router.get(...)`, and
adding rate limiting or security headers is one `app.use(...)`.

### How — Express ideas worth keeping

#### 1. Middleware runs in the order you register it

```ts
app.use(requestLogger);                     // 1. every request
app.use(express.json({ limit: "10kb" }));   // 2. parse bodies
app.use("/api", createApiRouter(service));  // 3. endpoints
app.use(notFoundHandler);                   // 4. only if nothing matched
app.use(errorHandler);                      // 5. only if something failed
```

Each middleware either **sends a response** or **calls `next()`**. If it does neither, the
request hangs. Put `notFoundHandler` before the router and *every* request becomes a 404.

#### 2. Error-handling middleware has four parameters

```ts
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => { ... };
```

Express identifies it **by its parameter count**, so all four must be declared even if unused.
Errors reach it from `throw` in any handler, `next(error)`, or Express's own JSON parser.

#### 3. Express 5 catches errors from async handlers

```ts
router.get("/feedback/:id/analysis", async (req, res) => {
  res.json({ analysis: await service.getFeedbackAnalysis(req.params.id) }); // may throw
});
```

In Express 4, a rejected promise here was an unhandled rejection, which crashes the process. Express 5
forwards it to `errorHandler`. A test (`catches errors thrown by async handlers`) proves it.

#### 4. Route-level middleware

```ts
router.post("/questions", requireJsonBody, async (req, res) => { ... });
```

Middleware listed in a route only runs for that route. `express.json()` quietly skips non-JSON
bodies, so `requireJsonBody` restores the precise 415 response the native server gave.

#### 5. `req.body` is `any`: validate it

`express.json()` parses the body but can't know its shape. Treat it exactly like Gemini's
output: untrusted until Zod says otherwise.

#### 6. Small security defaults

`app.disable("x-powered-by")` stops Express advertising itself in a response header, which helps
attackers and nobody else. (Rate limiting and other security headers come with deployment: on
Lambda, an in-memory rate limiter wouldn't work, because each instance has its own memory.)

#### 7. supertest: testing without a port

```ts
await request(app).post("/api/questions").send({ question: "..." }).expect(200);
```

Compare with the native tests' `listen(0)`, port lookup and `close()`. Both test suites check
the same behaviour, so the two servers are provably interchangeable.

### Remember

> **Frameworks remove plumbing, not decisions.** Status codes, validation and safe messages are
> still yours.
> **Middleware order is request order.** Error handler last, 404 just before it.
> **Four parameters = error middleware.**
> **`req.body` is untrusted input.** Validate it with Zod.

---

## 9. Costs: what the public demo will cost to run (Phase 4 preview)

> **Update:** we deployed on Cloudflare instead (see section 10). This section is kept because it
> explains how the AWS option would work if we move later.

Nothing has been created in AWS yet. This is the plan to review **before** anything is.
Prices are in US dollars (AWS bills in USD), checked in November 2026, and must be re-checked on
the AWS pricing pages before deploying.

### The proposed setup

```
Visitor
  ↓
feedback-analyser.davidcellini.co.uk  (DNS record + free ACM certificate)
  ↓
CloudFront ──── /api/* ────► Lambda (Express app, via a Lambda Function URL)
     │
     └── everything else ──► S3 bucket (private) with web/dist
```

- **S3** stores the frontend's static files (about 240 KB in total).
- **CloudFront** serves them over HTTPS worldwide, and routes `/api/*` to the backend. One
  origin, so no CORS.
- **Lambda** runs the Express app only when a request arrives. No visitors means no cost, unlike
  an always-on server, which you pay for even when idle.
- **A Lambda Function URL** gives Lambda an HTTPS address that CloudFront can call, without paying
  for API Gateway in between.

### Expected monthly cost at portfolio traffic

Say 1,000 visits a month, each making about 10 API requests:

| Service | What we'd use | Free allowance | Expected cost |
|---|---|---|---|
| S3 | ~240 KB stored, a few thousand reads | Pennies per GB | ~$0.00 |
| CloudFront | ~20,000 requests, ~1 GB out | Always free: 1 TB out + 10M requests/month | $0.00 |
| Lambda | ~10,000 requests, ~50 ms each at 128 MB | Always free: 1M requests + 400,000 GB-seconds/month | $0.00 |
| ACM certificate | One, for the subdomain | Free for use with CloudFront | $0.00 |
| CloudWatch Logs | A few MB of request logs | 5 GB ingestion/month | $0.00 (set 14-day retention) |
| DNS | One record (+ one for certificate validation) | Free at most registrars; Route 53 is $0.50/month per hosted zone | $0.00, or $0.00 extra if the zone already exists |
| Gemini | Replay mode makes **no** AI calls | n/a | $0.00 |
| GitHub Actions | Tests on push | Free for public repositories | $0.00 |

**Expected total: $0/month.** Lambda's and CloudFront's allowances above are "always free", so
they don't expire after 12 months.

### What could cost money, and how much

The main risk in replay mode is someone deliberately flooding the site with requests:

| Requests in a month | Roughly | Main cost |
|---|---|---|
| 1 million | $0 | Inside every free allowance |
| 10 million | ~$2 | Lambda requests over 1M ($0.20 per million) |
| 100 million | ~$110 | CloudFront requests (~$1 per million beyond 10M) + Lambda |

Ways to limit that:

1. **An AWS Budgets alert** (free) emailing at $1 and $5. It's an alert, **not a spending
   cap**: AWS has no hard cap.
2. **Lambda reserved concurrency** (free): limits how many copies of the function run at once,
   which limits how fast it can be called.
3. **CloudFront caching** of the `GET` endpoints: their answers never change in replay mode, so
   most requests never reach Lambda.
4. **A rate limit per visitor** with AWS WAF: about $5/month for the web ACL plus $1 per rule, unless
   your account can use CloudFront's $0 flat-rate Free plan, which includes WAF. Optional for replay
   mode, but **required before any live Gemini mode**.

Your existing portfolio on CloudFront already has the same exposure to a request flood, so this
doesn't add a new kind of risk.

### Later: a live Gemini mode

Each live question can make up to 5 Gemini calls (4 tool calls plus the final answer). That would
need a daily cap stored somewhere that all Lambda instances share, plus WAF rate limiting and a
switch to turn it off. It's a separate decision, for after launch.

### Milestone 3 (recording real Gemini responses)

About 100 Gemini calls, once: 24 analyses, 24 embeddings and a few agent conversations. That's
likely free on Gemini's free tier. Free-tier prompts may be used by Google to improve its
products, which is fine here because the data is synthetic. Even at paid rates it would be pennies.

### Remember

> **Pay per request, not per hour:** Lambda + CloudFront + S3 cost nothing when nobody visits.
> **Budgets alert; they don't cap.** Use limits (concurrency, caching, WAF) to bound the
> worst case.
> **Replay mode makes the AI cost zero.** Live mode is a separate decision with its own controls.

---

## 10. Deploying on Cloudflare (instead of AWS, for now)

### What

The demo deploys to **Cloudflare Workers**, the same way the portfolio does: Cloudflare Workers
Builds deploys every push to `main`. One Worker serves the React build as static files and runs
the Express API for `/api/*`. AWS remains a possible later step: only one small startup file
would change.

The AWS cost plan in section 9 still explains how the AWS option would work, but **it's not what
we deployed**.

### Why Cloudflare

Reading the portfolio repo showed it's on **Cloudflare**, not AWS CloudFront: a
`wrangler.jsonc` file, and a README saying Cloudflare Workers Builds deploys it. The GitHub
Actions workflow there only runs checks.

| | Cloudflare Workers (chosen) | AWS (section 9) |
|---|---|---|
| Matches the portfolio | Yes | No |
| Services to set up | 1 Worker | S3, CloudFront, Lambda, ACM, IAM, Budgets |
| Cost at portfolio traffic | £0 | ~£0 |
| Worst case | **Requests fail past the free limits; nothing is billed** | Billed per request; budget alerts aren't caps |
| Main limit | 10 ms CPU per request (free plan) | Generous |
| AWS learning | None | Lots |

A hard limit on spending is a real advantage for a public portfolio demo.

### How — the ideas worth keeping

#### 1. One app, several entry points

```
src/server/app.ts                        ← the Express app (knows nothing about hosting)
src/server/start-server.ts               → app.listen(3000)                  (local)
src/server/learning/start-native-server.ts → the framework-free version     (learning)
src/server/worker.ts                     → httpServerHandler({ port })       (Cloudflare)
```

Each entry point is a small **composition root**. Moving to AWS Lambda later means writing one
more of these, using a Lambda adapter, without touching the app, the service or the frontend.
That's the payoff from keeping HTTP out of the service and hosting out of the app.

#### 2. A Worker isn't Node.js

A Worker receives a web-standard `Request` and returns a `Response`. Express expects Node's
`http` server. The `nodejs_compat` flag provides a compatible `node:http`, and Cloudflare's
`httpServerHandler` connects the two. The `port` it uses is virtual: nothing listens on the
network.

#### 3. Routing static files vs the API

```jsonc
"assets": {
  "directory": "./web/dist",
  "run_worker_first": ["/api/*"],                  // API requests go to Express
  "not_found_handling": "single-page-application"  // other unknown paths → index.html
}
```

Without `run_worker_first`, Cloudflare would look for a static file first and, because of the
single-page-app setting, answer API requests with `index.html`.

#### 4. Measure, don't guess: cold starts and the CPU limit

The free plan allows **10 ms of CPU per request**. Measured on the server side:

| | Without warm-up | With warm-up |
|---|---|---|
| First question after startup | ~15–20 ms ❌ | ~2 ms ✅ |
| Warm question | ~1 ms | ~1 ms |
| Startup | — | ~13 ms (limited separately) |

Profiling showed the cause: Express's JSON body parser uses `iconv-lite`, whose first decode
builds its encoding tables (~41 ms), plus Zod's first parse (~2 ms). On a quiet site most visits
start a fresh instance, so "the first request" is most requests. `warm-up.ts` pays those costs
at startup instead. AWS Lambda has the same cold-start trade-off.

Measurements were taken in Node; Cloudflare's runtime uses the same V8 engine, but check the
Worker's **Metrics → CPU time** after deploying to confirm.

#### 5. CI checks; the platform deploys

`.github/workflows/ci.yml` runs types, lint, both test suites, both builds, and
`wrangler deploy --dry-run`, which bundles the Worker exactly as Cloudflare will without
uploading anything. It needs **no credentials**: deployment is Cloudflare's job, through its own
GitHub connection. Fewer secrets in CI means fewer secrets to leak.

Adding CI also meant fixing the last lint error in the repo (a deliberate `any` in a test, now
marked with an explained exception) and ignoring Wrangler's generated `.wrangler/` folder.

### Remember

> **Keep hosting at the edges.** One small entry file per platform makes moving platforms cheap.
> **Free-plan hard limits beat budget alerts** for a public demo.
> **Measure cold starts.** First-use costs can be ten times a warm request; move them to startup.
> **CI checks, the platform deploys.** No deployment credentials in GitHub.

---

## 11. Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-12 | Keep Chapters 8–9 notes in this file, separate from `LEARNING.md` | `LEARNING.md` covers AI concepts; this covers backend, frontend and AWS. |
| 2026-11-12 | Every new source file gets teaching comments (what, why, how) | Matches the style of Chapters 1–7 and the learning goal. |
| 2026-11-12 | Framework: native `node:http` exercise first, then Express 5 for the real API | Learn the mechanics, then the industry standard. |
| 2026-11-12 | Public demo starts in replay mode (confirmed) | £0 running cost; no public endpoint that can spend money. |
| 2026-11-12 | Single `package.json`; work on the `chapter-8-api` branch | Less setup to learn; you review and merge. |
| 2026-11-12 | Added `GroundingVerificationError` (same message as before) | The service must tell grounding failures from bugs without matching message text. |
| 2026-11-12 | Two deliberately faulty recordings, clearly labelled | Shows the validator working; labels keep the demo honest. |
| 2026-11-12 | ESLint: `ignoreRestSiblings: true` | Allows `const { removed, ...rest } = obj`, a standard way to drop a key. |
| 2026-11-12 | One error shape for every endpoint: `{ error: { code, message } }` | The frontend can handle all errors in one place. |
| 2026-11-12 | A rejected AI answer returns HTTP 200 | The request succeeded; the rejection is a result for the UI to show. |
| 2026-11-12 | Keep the native server permanently in `src/server/learning/` | You want to compare it with Express later. |
| 2026-11-12 | Build the frontend before the Express API | Get something visible sooner; the endpoints won't change. |
| 2026-11-12 | `web/` gets its own `package.json` (changes the earlier "single package" decision) | Browser-only dependencies stay out of the backend's deployment bundle. |
| 2026-11-12 | No free-text question box in replay mode | It would reject almost everything and imply the demo can do more than it does. |
| 2026-11-12 | Label responses "example responses" until Milestone 3 | They're hand-written placeholders, not recorded Gemini output. |
| 2026-11-12 | Express 5 API in `src/server/`; `dev:api` now runs it | Same contract as the native server, so the frontend didn't change. |
| 2026-11-12 | No in-process rate limiter yet | On Lambda each instance has its own memory, so limits belong at the gateway or CDN. |
| 2026-11-12 | Deploy on Cloudflare Workers, like the portfolio; AWS possibly later | Matches the existing setup; free-plan hard limits instead of open-ended billing. |
| 2026-11-12 | Warm up at Worker startup | Measured first-request CPU (~15–20 ms) exceeded the free plan's 10 ms limit; warm requests use ~1 ms. |
| 2026-11-12 | CI checks only; Cloudflare deploys | No deployment credentials stored in GitHub. |
| 2026-11-12 | Planned address: `feedback-analyser.davidcellini.co.uk` | A subdomain keeps the portfolio's existing CloudFront setup untouched. |

---

## 12. Glossary

| Term | Plain-English meaning |
|---|---|
| **Event loop** | The mechanism that lets one Node process juggle many requests by working on others while one is waiting on I/O. |
| **Stream** | Data that arrives (or is sent) in chunks over time rather than all at once. `req` and `res` are streams. |
| **Route** | A combination of HTTP method + path (e.g. `POST /api/questions`) mapped to a handler function. |
| **Handler** | The function that does the work for a route and sends the response. |
| **Middleware** | A function that runs before (or around) handlers — for parsing, logging, limits, auth. It responds or calls `next()`. |
| **Status code** | The number at the start of a response: 2xx success, 4xx the client's fault, 5xx the server's fault. |
| **Unhandled rejection** | A promise that fails with nothing to catch it. In modern Node this crashes the process. |
| **Service layer** | Code that does the app's actual work, independent of HTTP. Handlers call it. |
| **Record/replay** | Save an external system's responses once, then play them back instead of calling it. |
| **Decorator** | A wrapper with the same interface as the thing it wraps, adding behaviour around each call. |
| **Fail fast** | Detect broken configuration or data at startup, not when a user hits it. |
| **Composition root** | The one place (the entry point) where real dependencies are created and wired together. |
| **Graceful shutdown** | Stop taking new requests, finish current ones, then exit. |
| **Port 0** | Asks the operating system for any free port. Handy for tests. |
| **Origin** | Scheme + host + port, e.g. `http://localhost:5173`. A different port is a different origin. |
| **CORS** | Browser rules for requests across origins. Not authentication, and not a cost control. |
| **Dev proxy** | Vite forwarding `/api` to the backend, so the browser sees one origin. |
| **Race condition** | When the result depends on which of two async operations finishes first. |
| **Router** | An Express mini-app grouping related routes, mounted at a path such as `/api`. |
| **Error-handling middleware** | Express middleware with four parameters `(error, req, res, next)`; receives every error. |
| **supertest** | A library that sends requests to an Express app in tests without you managing a port. |
| **Cloudflare Worker** | Code that runs on Cloudflare's network per request; can also serve static files. |
| **Cold start** | Starting a fresh instance of a serverless function; first-use costs land here. |
| **Pre-warming** | Doing one-off work at startup so the first real request is fast. |
| **Dry run** | Doing everything except the final irreversible step (here: bundling without uploading). |
| **Per-request state** | Data that belongs to one request and must be created fresh for each one. |

---

## 13. Topics to revisit

- How Express's `next()` actually works under the hood (it's a small recursive function).
- Why a server should validate config at startup rather than at first use ("fail fast").
- Moving the API to AWS Lambda as a learning exercise: one new entry file using a Lambda adapter
  (see sections 9 and 10).
- Native schema-constrained output from Gemini, as a way to reduce structurally invalid answers
  (it doesn't replace Zod or grounding).
- How AWS Lambda differs from a long-running Node process (no shared memory between some
  invocations, cold starts) — relevant when we get to deployment.
