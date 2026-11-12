# Analysis

## Purpose

Analyses an individual employee feedback comment and returns a structured, validated result.

## Main entry point

`feedback-analyser.ts`

## How it works

```text
Feedback string
    ↓
feedbackAnalyser()
    ↓
AIProvider.analyzeFeedback()
    ↓
Gemini or mock provider
    ↓
JSON response
    ↓
Zod validation
    ↓
FeedbackAnalysis
```

## Key files

| File | Responsibility |
|---|---|
| `feedback-analyser.ts` | Coordinates feedback analysis |
| `feedback-analyser.test.ts` | Tests the analysis service |
| `feedback-schema.ts` | Defines and validates the expected result |
| `internal/priority.ts` | Helper for identifying high-priority feedback |

## Dependencies

- `providers/` — Supplies the AI implementation.
- `zod` — Validates the returned data.

## Learning concepts

- Dependency injection
- Runtime validation with Zod
- Separation of concerns
- Testing with mock providers

## Important distinction

This folder does not retrieve feedback from a database or read terminal arguments.

The calling code supplies the feedback string and AI provider.
