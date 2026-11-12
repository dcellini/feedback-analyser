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
5. [Decisions log](#5-decisions-log)
6. [Glossary](#6-glossary)
7. [Topics to revisit](#7-topics-to-revisit)

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

---

## 5. Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-12 | Keep Chapters 8–9 notes in this file, separate from `LEARNING.md` | `LEARNING.md` covers AI concepts; this covers backend, frontend and AWS. |
| 2026-11-12 | Every new source file gets teaching comments (what, why, how) | Matches the style of Chapters 1–7 and the learning goal. |
| 2026-11-12 | Framework: native `node:http` exercise first, then Express 5 for the real API (pending confirmation) | Learn the mechanics, then the industry standard. |
| 2026-11-12 | Public demo starts in replay mode (pending confirmation) | £0 running cost; no public endpoint that can spend money. |

---

## 6. Glossary

| Term | Plain-English meaning |
|---|---|
| **Event loop** | The mechanism that lets one Node process juggle many requests by working on others while one is waiting on I/O. |
| **Stream** | Data that arrives (or is sent) in chunks over time rather than all at once. `req` and `res` are streams. |
| **Route** | A combination of HTTP method + path (e.g. `POST /api/questions`) mapped to a handler function. |
| **Handler** | The function that does the work for a route and sends the response. |
| **Middleware** | A function that runs before (or around) handlers — for parsing, logging, limits, auth. It responds or calls `next()`. |
| **Status code** | The number at the start of a response: 2xx success, 4xx the client's fault, 5xx the server's fault. |
| **Unhandled rejection** | A promise that fails with nothing to catch it. In modern Node this crashes the process. |

---

## 7. Topics to revisit

- How Express's `next()` actually works under the hood (it's a small recursive function).
- Why a server should validate config at startup rather than at first use ("fail fast").
- How AWS Lambda differs from a long-running Node process (no shared memory between some
  invocations, cold starts) — relevant when we get to deployment.
