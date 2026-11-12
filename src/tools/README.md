# Tools — AI Tool Calling and Agents

**Chapters 5–7 — Tool Calling, Agents and Verified Answers**

## 1. What does this folder do?

The `tools/` folder allows Gemini to request actions that our TypeScript application can perform.

For example, a user might ask:

"How many employees complained about management?"

Instead of guessing, Gemini can request tools that search employee feedback or calculate statistics.

Our application runs the requested tools and returns the results to Gemini.

**Important:** Gemini decides which tools to request, but our TypeScript code controls what actually executes.

## 2. Why do we need tool calling?

A normal LLM can generate answers based on its training and the information supplied in a prompt.

However, it cannot automatically access our application's feedback data or execute our TypeScript functions.

Tool calling bridges that gap.

Our project currently provides two main tools:

- **`searchFeedback`** — Finds feedback relevant to a question using semantic search.
- **`getFeedbackStats`** — Calculates statistics from the available feedback.

This allows Gemini to work with real application data rather than relying entirely on generated text.

## 3. How does it work?

```text
User asks a question
        ↓
answerWithTools()
        ↓
Send question and tool definitions to Gemini
        ↓
Gemini responds
        │
        ├── Final answer
        │
        └── Tool request
                ↓
           executeToolCall()
                ↓
           Validate arguments
                ↓
           Run approved TypeScript tool
                ↓
           Return result to Gemini
                ↓
           Gemini continues
        ↓
Final answer
```

The agent can make multiple tool requests, subject to a configured limit, before returning its answer.

## 4. Folder structure

```text
tools/
├── README.md
├── answer-with-tools.ts
├── answer-with-tools.test.ts
├── answer-with-verified-tools.test.ts
│
├── agent/
│   └── feedback-agent-instructions.ts
│
├── definitions/
│   ├── search-feedback-declaration.ts
│   ├── search-feedback-schema.ts
│   └── get-feedback-stats-declaration.ts
│
├── implementations/
│   ├── search-feedback-tool.ts
│   └── get-feedback-stats-tool.ts
│
├── providers/
│   ├── gemini-tool-provider.ts
│   └── gemini-api-client.ts
│
├── internal/
│   └── execute-tool-call.ts
│
├── tests/
│   ├── answer-evidence-requirements.test.ts
│   ├── answer-with-numerical-verification.test.ts
│   └── grounded-agent.integration.test.ts
│
└── manual/
    ├── answer-with-tools.gemini.manual.ts
    ├── answer-with-tools.mock.manual.ts
    ├── answer-with-verified-tools.gemini.manual.ts
    └── answer-with-verified-tools.mock.manual.ts
```

Other existing unit tests remain alongside the files they test.

## 5. Main files and folders

| Location | Responsibility |
|---|---|
| `answer-with-tools.ts` | Main workflow that coordinates Gemini and tool execution |
| `agent/` | Instructions guiding Gemini's behaviour |
| `definitions/` | Describes tools and their expected arguments |
| `implementations/` | Contains the actual TypeScript tool functions |
| `providers/` | Communicates with Gemini and handles API requests |
| `internal/` | Executes approved tool requests |
| `tests/` | Tests evidence, numerical verification and integration behaviour |
| `manual/` | Scripts for experimenting with mock and real Gemini workflows |

**Start with:** `answer-with-tools.ts`, then `internal/execute-tool-call.ts`.

## 6. Tool definitions vs implementations

This is one of the most important concepts in the folder.

### Definition

`search-feedback-declaration.ts` tells Gemini:

"There is a tool called searchFeedback that can search employee feedback."

It describes the tool and its arguments.

### Implementation

`search-feedback-tool.ts` contains the TypeScript functionality that actually performs the search.

For example:

```text
Gemini requests:
searchFeedback({ query: "parking problems" })
            ↓
TypeScript validates the request
            ↓
Application searches feedback
            ↓
Matching feedback is returned
```

The model cannot execute arbitrary TypeScript. Only tools explicitly supported by our application can run.

## 7. What makes this an AI agent?

Basic tool calling involves a model requesting a tool and receiving its result.

An agent goes further by repeating that process.

For example:

1. Gemini searches feedback about management.
2. Gemini examines the returned results.
3. Gemini requests feedback statistics.
4. Gemini combines the information into an answer.

The application maintains the conversation and tool results between steps.

Our agent has limits on tool execution to prevent it from continuing indefinitely.

## 8. What are verified answers?

In Chapter 7, we extended the agent workflow to check whether generated answers are supported by evidence.

For example:

Question: "How many employees mentioned parking?"

Suppose the statistics tool reports three matching employees, but Gemini answers five.

Our verification logic can identify certain unsupported numerical claims.

The verified workflow uses functionality from `grounding/` to check things such as:

- Source references
- Feedback quotations
- Supported numerical claims
- Whether sufficient evidence is available

The tests in `tests/` exercise these behaviours.

Verification helps reduce hallucinations, but it cannot guarantee that every answer is correct.

## 9. What do the providers do?

**`gemini-tool-provider.ts`**

Communicates with Gemini, sends tool declarations and handles model responses containing tool requests.

**`gemini-api-client.ts`**

Handles shared HTTP concerns for Gemini requests, including timeouts, retries and certain API errors.

Keeping this logic separate means the main agent workflow doesn't need to manage HTTP requests directly.

## 10. How does this connect to the rest of the project?

```text
User question
      ↓
tools/
      │
      ├── embeddings/
      │      Semantic feedback search
      │
      ├── implementations/
      │      Feedback statistics
      │
      └── grounding/
             Verify supported claims
      ↓
Final AI answer
```

The tools feature builds on earlier chapters rather than replacing them.

`analysis/` analyses individual feedback.

`rag/` retrieves relevant feedback and generates answers.

`tools/` lets an AI agent decide when to request searches, statistics or other approved actions.

`grounding/` supplies verification functions for evidence-backed answers.

## 11. What am I learning?

**Tool calling:** Allowing an LLM to request predefined application functions.

**Agent loops:** Repeatedly using tools and their results to complete a task.

**Function declarations:** Describing available tools to an AI model.

**Runtime validation:** Checking tool arguments before executing them.

**Closures and dependency injection:** Providing tools with access to their required data and dependencies.

**Allowlisting:** Restricting execution to explicitly supported tools.

**Grounding:** Checking generated claims against available evidence.

**Retries and timeouts:** Handling temporary API failures more reliably.

**Mocking:** Testing agent behaviour without relying on live Gemini requests.

## 12. Manual scripts and API usage

The `manual/` folder contains scripts for exploring the agent workflows.

- `*.mock.manual.ts` — Uses controlled mock responses, without real Gemini requests.
- `*.gemini.manual.ts` — Uses Gemini and may consume API quota.

The automated unit tests are intended to remain deterministic wherever possible.

## 13. Current limitations

- The agent can only use tools we've explicitly implemented.
- Semantic search depends on the quality of the embeddings and available feedback.
- The agent has a maximum number of tool calls.
- Grounding checks do not verify every possible factual claim.
- Gemini requests may fail or reach usage limits.
- The current project does not yet expose the agent through the planned HTTP API or React frontend.

## 14. Things to remember

- Gemini requests tools; TypeScript executes them.
- Definitions describe tools, implementations perform the work.
- `executeToolCall()` validates and dispatches approved requests.
- `answerWithTools()` coordinates the agent loop.
- Tools can be called multiple times before a final answer.
- The verified workflow adds evidence checks.
- Mock tests help us test behaviour without real API calls.

**In one sentence:** The tools folder turns our feedback analyser into an AI agent that can search data, calculate statistics and produce answers with additional evidence verification.