# Feedback Analyser

A small AI-powered employee feedback analysis application built to learn practical AI engineering using TypeScript, Node.js and Gemini.

The goal is to understand how to build **reliable software around LLMs**, rather than simply learning how to write prompts.

**Learning approach: Build → understand → document → move on.**

## 1. What does the application do?

The project has grown from analysing individual employee comments into an application that can search feedback, answer questions and verify parts of its AI-generated answers.

It currently supports:

- **Feedback analysis** — Identifies sentiment, themes, priority and a summary.
- **Evaluation** — Checks how accurate and useful AI-generated analyses are.
- **Semantic search** — Finds relevant feedback based on meaning rather than exact words.
- **RAG** — Retrieves feedback and uses it to answer questions.
- **Tool calling** — Allows Gemini to request approved TypeScript functions.
- **AI agents** — Supports multiple tool calls to answer more complex questions.
- **Grounding** — Checks source references, quotations and supported numerical claims.
- **Privacy** — Provides basic redaction of email addresses and UK mobile numbers.

These features are implemented as separate, reusable parts of the application.

## 2. Technology stack

| Technology | Purpose |
|---|---|
| TypeScript | Main programming language |
| Node.js | Runs the application |
| Gemini API | AI analysis, embeddings and generation |
| Zod | Runtime validation of external data |
| Vitest | Automated testing |
| Native `fetch` | HTTP requests to Gemini |

We also use mock providers to test AI-related functionality without making real API calls.

## 3. Project structure

The project is organised by **feature**, with each folder containing its main workflow, supporting code, tests and README.

```text
feedback-analyser/
├── src/
│   ├── analysis/
│   │   └── README.md
│   │
│   ├── providers/
│   │   └── README.md
│   │
│   ├── evaluation/
│   │   ├── deterministic/
│   │   ├── semantic/
│   │   ├── judge/
│   │   ├── fixtures/
│   │   └── README.md
│   │
│   ├── embeddings/
│   │   ├── providers/
│   │   ├── internal/
│   │   ├── manual/
│   │   └── README.md
│   │
│   ├── rag/
│   │   └── README.md
│   │
│   ├── tools/
│   │   ├── agent/
│   │   ├── definitions/
│   │   ├── implementations/
│   │   ├── providers/
│   │   ├── internal/
│   │   ├── tests/
│   │   ├── manual/
│   │   └── README.md
│   │
│   ├── grounding/
│   │   ├── internal/
│   │   └── README.md
│   │
│   └── privacy/
│       └── README.md
│
├── package.json
└── README.md
```

### Where should I start?

| Folder | What you'll find |
|---|---|
| [`analysis/`](src/analysis/README.md) | Individual feedback analysis and Zod validation |
| [`providers/`](src/providers/README.md) | Gemini and mock providers for feedback analysis |
| [`evaluation/`](src/evaluation/README.md) | Measuring AI response quality |
| [`embeddings/`](src/embeddings/README.md) | Embeddings, similarity and semantic search |
| [`rag/`](src/rag/README.md) | Answering questions using retrieved feedback |
| [`tools/`](src/tools/README.md) | Tool calling, AI agents and verified workflows |
| [`grounding/`](src/grounding/README.md) | Checking claims against supporting evidence |
| [`privacy/`](src/privacy/README.md) | Basic personal-data redaction |
| [`demo/`](src/demo/README.md) | Chapter 8: replay-mode portfolio demo (synthetic data, no Gemini calls) |
| [`server/`](src/server/app.ts) | Chapter 8: the Express 5 API over the demo service |
| [`server/learning/`](src/server/learning/native-http-server.ts) | Chapter 8: the same API without a framework (learning exercise) |
| [`web/`](web/README.md) | Chapter 9: React frontend for the demo |

**Each folder has its own README explaining what it does, why it's needed, how it works and which files to explore first.**

## 4. How does everything fit together?

The project contains several related workflows rather than one large pipeline.

### Individual feedback analysis

```text
Employee feedback
       ↓
AIProvider (Gemini or mock)
       ↓
AI-generated JSON
       ↓
Zod validation
       ↓
Structured FeedbackAnalysis
       ↓
Evaluation (when requested)
```

A typical analysis contains:

```json
{
  "sentiment": "negative",
  "themes": ["workload", "management"],
  "priority": "high",
  "summary": "The employee reports excessive workload and limited management support."
}
```

Zod ensures the response has the expected structure, but it does not guarantee that the analysis is factually correct.

### Searching and answering questions

```text
Employee feedback
       ↓
Generate embeddings
       ↓
Semantic search
       ↓
Retrieve relevant comments
       ↓
RAG
       ↓
AI-generated answer with sources
```

For example:

"What are employees saying about workload?"

The application searches for relevant feedback and supplies it to Gemini to help generate an answer.

### AI agents and verified answers

```text
User question
       ↓
AI agent
       ↓
Gemini requests tools
       │
       ├── Search feedback
       └── Calculate statistics
       ↓
Return tool results to Gemini
       ↓
Generate an answer
       ↓
Grounding / verification
       ↓
Final result
```

The agent can request multiple tools, while TypeScript validates and controls their execution.

Grounding checks certain evidence-backed claims. It does not guarantee that every statement is correct.

## 5. Testing and evaluation

A key objective is to build AI functionality that can be tested reliably.

We use several approaches:

| Approach | What it checks |
|---|---|
| Unit tests | Whether our TypeScript logic behaves correctly |
| Mock providers | Whether workflows work without external API calls |
| Zod validation | Whether external responses have the expected structure |
| Deterministic evaluation | Sentiment, priority, themes and basic summary checks |
| Semantic evaluation | Whether themes have similar meanings |
| LLM-as-a-Judge | AI assessment of analysis quality |
| Grounding | Whether certain claims are supported by available evidence |

These techniques complement one another.

**Valid JSON doesn't mean a good answer, and a good-looking answer doesn't necessarily mean a supported answer.**

## 6. Running the project

Install dependencies:

```bash
npm install
```

Run automated tests:

```bash
npm test
```

Check TypeScript:

```bash
npx tsc --noEmit
```

### Using Gemini

Real Gemini integrations require a `GEMINI_API_KEY` configured in your local `.env` file.

Manual scripts are available within the relevant feature folders, including the embeddings and tools features.

Scripts using Gemini may make real API requests and consume quota. Mock scripts and automated unit tests are preferred when learning or testing application logic.

Do not commit API keys or `.env` files containing secrets.

## 7. Learning progress

### Completed — Chapters 1–7

| Chapter | Topic | Key concepts |
|---|---|---|
| 1 | AI integration | Gemini API, structured output, Zod validation |
| 2 | Evaluation | Fixtures, deterministic checks, LLM judges |
| 3 | Embeddings | Vectors, cosine similarity, semantic search |
| 4 | RAG | Retrieval, context building, evidence-backed generation |
| 5 | Tool calling | Tool definitions, argument validation, execution |
| 6 | AI agents | Closures, dependency injection, multi-step tool loops |
| 7 | Reliability and grounding | Evidence checks, numerical verification, privacy and retries |

The project has been developed incrementally, extending the existing application as new concepts were introduced.

### Planned — Chapters 8–9

**Chapter 8 — Node.js API and AWS**

Turn the existing functionality into an application that can be accessed through HTTP endpoints.

Potential learning areas:

- Node.js HTTP APIs
- Request and response validation
- Error handling and service boundaries
- AWS deployment and infrastructure fundamentals
- Logging and observability

**Chapter 9 — React frontend**

Build a simple interface for interacting with the Feedback Analyser.

Potential features:

- Submit employee feedback
- View structured analysis results
- Search feedback
- Ask questions using RAG or the AI agent
- Display supporting evidence and verification results

These chapters are planned, not yet implemented. Their exact scope will be decided as development continues.

## 8. Engineering principles

Throughout the project, we're practising several important patterns:

- **Treat AI responses as untrusted data.** Validate external responses before using them.
- **Separate responsibilities.** Keep application workflows independent of specific AI providers.
- **Use dependency injection.** Make services easier to test and reuse.
- **Prefer deterministic tests.** Use mocks rather than relying on live AI requests.
- **Measure quality.** Use evaluation alongside traditional testing.
- **Verify evidence.** Don't assume that a convincing AI answer is correct.
- **Control tool execution.** Only allow explicitly supported actions.
- **Handle failures.** Account for timeouts, rate limits and invalid responses.
- **Build incrementally.** Extend the working application rather than creating disconnected exercises.

## 9. Project purpose

This is a **learning project**, not a production-ready employee feedback platform.

It does not currently provide complete privacy protection, authentication, persistent vector storage, production monitoring or deployment.

The aim is to develop practical, transferable skills for building modern AI-enabled applications using TypeScript, Node.js and cloud services.

**Build → understand → document → move on.**