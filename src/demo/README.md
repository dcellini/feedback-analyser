# Demo

## Purpose

Runs the public portfolio demo **without calling Gemini**.

A synthetic dataset, plus recorded AI responses, is replayed through the **real** Chapters 1–7
pipeline: tools execute, personal data is redacted, Zod validates, and grounding verifies.
Only the AI's replies are recorded.

## Main entry point

`demo-service.ts` → `createReplayDemoService()`

```ts
const service = await createReplayDemoService();

service.listFeedback();                 // 24 synthetic comments (redacted)
await service.getFeedbackAnalysis("fb-003");
service.listExampleQuestions();         // 6 example questions
await service.askQuestion("What do employees say about their managers?");
```

## How a question is answered

```text
Question
   ↓
Find the matching recording ──── none → DemoServiceError("QUESTION_NOT_AVAILABLE")
   ↓
Fresh replay provider, wrapped in a fresh tool-call trace   (per request)
   ↓
answerWithVerifiedTools()                                   (Chapter 7, unchanged)
   ├─ searchFeedback / getFeedbackStats run for real
   ├─ results redacted
   └─ answer validated and grounded
   ↓
{ outcome: "verified", answer, toolCalls }
   or
{ outcome: "rejected", reason, toolCalls }   ← grounding or structure failed
   or
thrown error                                 ← a bug: becomes a generic 500 later
```

## Key files

| File | Responsibility |
|---|---|
| `demo-service.ts` | The service the HTTP API will call |
| `data/demo-feedback.ts` | 24 invented comments |
| `data/demo-embeddings.ts` | **Placeholder** vectors (real ones recorded in Milestone 3) |
| `data/demo-analyses.ts` | **Placeholder** recorded analyses |
| `data/demo-recordings.ts` | Recorded agent conversations: 4 genuine, 2 deliberately faulty |
| `providers/replay-tool-provider.ts` | Plays back a recorded conversation |
| `providers/recorded-ai-provider.ts` | Looks up a recorded analysis |
| `internal/trace-tool-calls.ts` | Decorator that notes which tools the agent called |

## The two deliberately faulty recordings

`invented-quote` and `wrong-count` replay the kinds of mistakes real models make. They exist so
the demo can show the validator rejecting them. Each one has a `note` starting with
"Deliberately faulty example", and the UI must display it, so visitors aren't misled about
what Gemini actually did.

## Learning concepts

- Record/replay testing
- Shared read-only state vs per-request state
- The decorator pattern
- Custom error classes and `instanceof`
- Expected failures (return a result) vs unexpected failures (throw)
- Failing fast at startup

## Important distinction

This folder knows nothing about HTTP. Status codes, request parsing and responses belong to the
API layer (Milestone 2).
