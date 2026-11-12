# Feedback Analyser — Developer Guide

> **Updated: November 2026 · Chapters 1–7 implemented · Chapters 8–9 planned**
>
> This guide explains the application end to end. The root `README.md` is the quick overview; each `src/<feature>/README.md` explains its own feature in more detail.
>
> **Source note:** Technical behaviours are based on the previous Application & Developer Guide and project learning notes. Folder paths reflect the reorganisation discussed in November 2026; they have not been independently verified against a newly uploaded source tree. Check actual filenames before running manual scripts.

## 1. Purpose and current scope

Feedback Analyser is a TypeScript/Node.js learning application for building reliable software around large language models. It is **not yet a deployed service** and has **no implemented HTTP API or React frontend**. Its functionality currently runs through code, tests and manual scripts.

The application explores eight related capabilities:

| Feature | What it does | Where to learn more |
| --- | --- | --- |
| Analysis | Turns one feedback comment into sentiment, themes, priority and summary | [`src/analysis/README.md`](../src/analysis/README.md) |
| Providers | Swaps real Gemini and mock analysis implementations | [`src/providers/README.md`](../src/providers/README.md) |
| Evaluation | Checks quality using rules, embeddings and an AI judge | [`src/evaluation/README.md`](../src/evaluation/README.md) |
| Embeddings | Converts text to vectors and finds semantically similar feedback | [`src/embeddings/README.md`](../src/embeddings/README.md) |
| RAG | Answers questions using retrieved feedback as context | [`src/rag/README.md`](../src/rag/README.md) |
| Tools | Lets Gemini request approved searches and statistics | [`src/tools/README.md`](../src/tools/README.md) |
| Grounding | Checks structured answers, source references, quotes and supported numerical claims | [`src/grounding/README.md`](../src/grounding/README.md) |
| Privacy | Offers basic email and UK mobile-number redaction | [`src/privacy/README.md`](../src/privacy/README.md) |

## 2. Stack and getting started

- **TypeScript and Node.js (ES modules):** application logic and runtime.
- **Gemini API:** model-generated analysis, embeddings, answers and tool requests.
- **Zod:** runtime validation of untrusted data.
- **Vitest:** repeatable tests with mocks.
- **Native `fetch`:** HTTP integration; Gemini integration also has a reusable API client for the tools workflow.

From the project root:

```bash
npm install
npm test
npx tsc --noEmit
```

The older source archive also defined `npm run typecheck` and `npm run lint`; use those if they are still present in your current `package.json`.

**Real API calls:** Gemini manual scripts require `GEMINI_API_KEY` in a local `.env`. They may consume API quota. Prefer tests and mock manual scripts first. Do not commit `.env` or keys. Because files moved, use the current script paths shown in VS Code rather than older commands in archived documentation.

## 3. Architecture: separate workflows, shared concepts

There is no single application entry point yet. Three important flows are:

```text
A. Analyse a comment
   Feedback → AIProvider → JSON.parse → Zod → FeedbackAnalysis
                                        └→ optional evaluation

B. Answer with retrieval (RAG)
   Feedback → embeddings / prepared records
   Question → semantic search → evidence prompt → answer + sources

C. Answer with an agent
   Question → Gemini → approved tool request → TypeScript executes tool
                       ↑                       │
                       └──── tool result ──────┘
             → structured answer → grounding checks
```

The central boundary is: **Gemini proposes and generates; TypeScript validates, controls tool execution and checks available evidence.**

## 4. Project navigation

The feature-based organisation puts primary workflows at each feature root and lower-level code in subfolders.

```text
src/
├── analysis/                 # Analyse a single feedback comment
├── providers/                # AIProvider and Gemini/mock analysis providers
├── evaluation/
│   ├── deterministic/        # Exact-value and basic summary checks
│   ├── semantic/             # Meaning-based theme checks
│   ├── judge/                # Gemini and mock LLM judges
│   └── fixtures/             # Expected analysis examples
├── embeddings/
│   ├── providers/            # Gemini, mock and cached embeddings
│   ├── internal/             # Cosine similarity
│   └── manual/               # Embedding experiments
├── rag/                      # Retrieval-augmented answer workflow
├── tools/
│   ├── agent/                # Agent instructions
│   ├── definitions/          # Tool declarations and schemas
│   ├── implementations/      # Actual search/statistics functions
│   ├── providers/            # Gemini tool provider and API client
│   ├── internal/             # Approved tool dispatcher
│   ├── tests/                # Cross-workflow and integration tests
│   └── manual/               # Mock and real Gemini demonstrations
├── grounding/
│   └── internal/             # Individual evidence verifiers
└── privacy/                  # Basic redaction
```

Tests generally live beside the files they test. The tools feature additionally groups integration/evidence tests in `tools/tests/`. This map intentionally omits most filenames; the feature READMEs provide the detailed map.

## 5. Walkthrough A — analyse one feedback comment

**Read first:** `src/analysis/feedback-analyser.ts`, then the feedback schema and `src/providers/ai-provider.ts`.

1. The caller supplies feedback and an `AIProvider` implementation.
2. A Gemini provider can return JSON text; a mock provider returns controlled output for tests.
3. The analysis service parses the response to an `unknown` value.
4. Zod checks that the object has the required sentiment, themes, priority and summary fields.
5. Only the validated `FeedbackAnalysis` is returned.

```ts
// Illustrative example: import paths and provider construction omitted.
const result = await feedbackAnalyser({
  feedback: 'My manager listens, but our workload is too high.',
  aiProvider,
});

// result has validated sentiment, themes, priority and summary fields.
```

**Why it matters:** TypeScript types disappear at runtime. A model may return malformed or misleading content. A valid Zod schema catches structural problems, **not factual errors**.

**Provider interface and dependency injection:** The service depends on an `AIProvider` contract, not Gemini directly. Tests inject a mock so the application logic can be exercised without a network call.

## 6. Walkthrough B — evaluate quality

**Read first:** `src/evaluation/evaluate-analysis.ts`.

The combined evaluation coordinates several checks and preserves their individual results:

| Method | Main location | Question answered | Limitation |
| --- | --- | --- | --- |
| Deterministic | `evaluation/deterministic/evaluate-feedback.ts` | Do sentiment, priority and expected themes match? | Synonyms may be rejected |
| Summary | `evaluation/deterministic/evaluate-summary.ts` | Does the summary contain expected wording? | Text matching is not meaning |
| Semantic | `evaluation/semantic/evaluate-themes.ts` | Are the themes similar in meaning? | Similarity is not proof of correctness |
| LLM judge | `evaluation/judge/` | Does another model judge the analysis useful and faithful? | Judges can be inconsistent or wrong |

`evaluation/fixtures/` holds representative feedback and expected analyses. Fixtures are **reference expectations**, not the only defensible interpretation of a comment. Mock judges support deterministic tests; a Gemini judge involves real API usage when explicitly invoked.

**Example:** The expected theme is `recognition`, while the generated summary says `the employee feels valued`. A keyword test might fail even though a person sees related meaning. That motivates semantic and judge-based checks.

## 7. Walkthrough C — embeddings and RAG

**Read first:** `src/embeddings/prepare-feedback.ts`, `src/embeddings/semantic-search.ts`, then `src/rag/answer-feedback-question.ts`.

### Prepare feedback

`prepareFeedback()` uses an `EmbeddingProvider` to attach vectors to feedback. Real Gemini, mock and cached embedding providers are grouped under `embeddings/providers/`.

### Search

`semanticSearch()` embeds a question, compares it with prepared feedback using cosine similarity, sorts by score and returns the top matches. The inspected implementation performs **top-k ranking without a minimum similarity threshold**. A top result can therefore still be a weak match.

### Generate an answer

`answerFeedbackQuestion()` retrieves matches, builds source-labelled context, constructs the prompt and calls a `RagAnswerProvider` (Gemini or mock). It returns an answer and source records.

```text
Question: "What concerns are people raising about workload?"
   ↓
Embed question → rank prepared comments → select top results
   ↓
Build context with source IDs → construct prompt → ask model
   ↓
{ answer, sources }
```

**Important:** RAG makes evidence available to a model. It does not guarantee that the answer correctly interprets the evidence.

## 8. Walkthrough D — tool calling and agents

**Read first:** `src/tools/answer-with-tools.ts`, then `src/tools/internal/execute-tool-call.ts`.

The tool feature separates four jobs:

1. **Definitions** (`tools/definitions/`) tell Gemini what tools exist and what arguments they accept.
2. **Implementations** (`tools/implementations/`) contain the actual TypeScript search and statistics functions.
3. **Dispatcher** (`tools/internal/execute-tool-call.ts`) validates and allows only recognised requests.
4. **Provider** (`tools/providers/gemini-tool-provider.ts`) exchanges model requests, tool calls and results.

Two main tools are implemented:

- `searchFeedback`: semantic search over available feedback; its factory captures feedback and embedding dependencies through a **closure**.
- `getFeedbackStats`: deterministic statistics/counting over available feedback.

The agent loop can receive a tool request, execute it, return the result and ask Gemini again. The implementation places bounds on the number of calls and handles some tool errors. The model cannot execute arbitrary TypeScript: only the application’s allowlisted functions are available.

**Tool declaration is not execution.** A declaration says what Gemini may request; an implementation performs the work; the dispatcher decides whether the request is valid.

## 9. Walkthrough E — a question through the verified agent

This is a **conceptual trace of the implemented components**, not a claim that this exact question was run against Gemini.

**Question:** “How many employees raised parking concerns? Show supporting feedback.”

```text
1. Caller sends question to the agent workflow.
        ↓
2. Gemini sees instructions and approved tool declarations.
        ↓
3. Gemini requests searchFeedback({ query: "parking" }).
        ↓
4. TypeScript validates arguments and executes semantic search.
        ↓
5. Matching feedback and source IDs return to Gemini.
        ↓
6. Gemini may request getFeedbackStats(...) for a count.
        ↓
7. TypeScript computes the supported statistic and returns it.
        ↓
8. Gemini produces a structured, source-linked answer.
        ↓
9. Grounding validates the schema, allowed sources,
   exact quotations and supported numerical claims.
        ↓
10. The calling workflow receives the verified result
    or a controlled validation/insufficient-evidence outcome.
```

The precise order and choice of tools are model-dependent; Gemini might choose a different sequence or answer without both tools. In Chapter 7's documented live demonstration, Gemini tool calls were real but **embeddings were mocked**. The mock and Gemini manual scripts in `src/tools/manual/` illustrate the distinction.

### Grounding boundaries

`src/grounding/validate-grounded-answer.ts` is the main verifier. `grounded-answer-schema.ts` distinguishes answered from insufficient-evidence responses. Helpers in `grounding/internal/` check individual claims, exact feedback quotations and supported numerical claims. The separate numerical-answer test remains at the `grounding/` root.

A source ID can be valid even when a claim misinterprets its source. Grounding is **not universal fact-checking**.

## 10. Privacy, API reliability and trust boundaries

`src/privacy/redact-personal-data.ts` handles common email addresses and UK mobile numbers. It is **not comprehensive anonymisation**: names, addresses, sensitive facts and other identifiers may remain. Redaction must be invoked by the relevant workflow; its existence does not mean all requests are automatically protected.

`src/tools/providers/gemini-api-client.ts` encapsulates timeouts, bounded retries, exponential backoff, `Retry-After` handling and categorised API errors. Transient errors such as rate limits and service unavailability may be retried; ordinary permanent client errors should not be blindly retried. These are useful reliability patterns but do not replace production monitoring or operational controls.

Feedback itself is untrusted input. It may contain instructions intended to manipulate the model. Tool allowlisting, argument validation, structured outputs and evidence checks help constrain behaviour, but do not eliminate prompt-injection risk.

## 11. Tests and manual demonstrations

| Test type | Purpose | Real Gemini? |
| --- | --- | --- |
| Unit tests | Check schemas, helpers and orchestration | No, when mocks are used |
| Integration tests with mocks | Check multi-step workflows across components | No |
| Manual mock scripts | Inspect tool or RAG behaviour interactively | No |
| Manual Gemini scripts | Exercise the real provider and model behaviour | **Yes — quota may be consumed** |

For tools, the reorganised manual folder contains:

```text
src/tools/manual/
├── answer-with-tools.gemini.manual.ts
├── answer-with-tools.mock.manual.ts
├── answer-with-verified-tools.gemini.manual.ts
└── answer-with-verified-tools.mock.manual.ts
```

The cross-workflow tests include evidence requirements, numerical verification and grounded-agent integration. These tests check specific behaviours; they do not prove that every possible generated answer is true.

After moving code in VS Code, check imports and run:

```bash
npx tsc --noEmit
npm test
```

ESM TypeScript imports may use `.js` specifiers even when the source files end in `.ts`.

## 12. Design decisions worth remembering

| Pattern | Why it exists |
| --- | --- |
| Zod at model boundaries | Types alone do not validate runtime JSON |
| Provider interfaces | Business logic should not depend on one model vendor |
| Dependency injection | Swap real and mock dependencies without rewriting workflows |
| Closures in tool factories | Retain access to feedback and embedding providers safely |
| Evaluation fixtures | Compare changes against consistent reference examples |
| Multiple evaluation strategies | Exact matching, semantic similarity and judges have different weaknesses |
| Tool allowlisting | Model requests must not become arbitrary code execution |
| Source-linked grounded answers | Make specific claims checkable against supplied evidence |
| Bounded retries and agent loops | Prevent uncontrolled repeated calls |
| Separate manual scripts | Make live API usage an explicit choice |

## 13. Current limitations

**Implemented:** individual feedback analysis, schema validation, mock and Gemini providers, evaluation, embeddings and semantic search, RAG, tool calling, a bounded two-tool agent, structured grounding checks, basic redaction and Gemini API resilience.

**Not established:** a production-grade privacy model, authentication/authorisation, a persistent vector database, deployed HTTP API, React UI, full observability, production infrastructure or comprehensive factual verification.

The application is intentionally a learning system rather than a finished employee feedback product.

## 14. Next chapters

### Chapter 8 — Node.js API and AWS (planned)

Expose existing workflows through HTTP endpoints, define request/response boundaries, handle errors and validation, and explore AWS deployment, logging and operational considerations. Exact endpoints and deployment architecture remain to be designed.

### Chapter 9 — React frontend (planned)

Build an interface for submitting feedback, inspecting analyses, asking questions and viewing sources/verification results. This is planned, not implemented.

## 15. How to maintain this guide

After each chapter or refactor:

1. Update the root `README.md` for the high-level feature and status changes.
2. Update the affected feature README for file locations and behaviour.
3. Update **this guide** only for cross-feature architecture, significant implementation decisions and end-to-end flows.
4. Verify script paths against the current repository before documenting runnable commands.
5. Label new capabilities **implemented**, **tested with mocks**, **manually demonstrated**, or **planned** accurately.

**Learning principle: Build → understand → document → move on.**
