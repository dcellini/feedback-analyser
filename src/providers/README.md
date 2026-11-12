# Providers — Connecting Our Application to AI

**Chapters 1–2 — AI Providers, Interfaces and Mocking**

## 1. What does this folder do?

The `providers/` folder contains the code that connects our Feedback Analyser to an AI model.

Currently, we use **Google Gemini** to analyse feedback.

However, we don't want the rest of our application to depend directly on Gemini.

Instead, we use a **provider** — a piece of code responsible for communicating with an AI service.

This allows us to switch between real AI and fake responses used for testing.

## 2. Why do we need providers?

Imagine our application wants to analyse this feedback:

"My manager is supportive, but communication could improve."

We could write the Gemini API request directly inside `feedbackAnalyser()`.

But that would cause problems:

- Testing would require real Gemini API calls.
- Changing AI models would require rewriting our analysis logic.
- The application would be harder to maintain.

Instead, our analysis service asks a provider to do the AI work.

The provider handles how that work gets done.

## 3. How does it work?

```text
feedbackAnalyser()
       ↓
AIProvider interface
       ↓
   Which provider?
       │
       ├── Gemini Provider
       │      ↓
       │   Real Gemini API
       │
       └── Mock Provider
              ↓
          Fake response
       ↓
Result returned to feedbackAnalyser()
       ↓
JSON parsed and validated with Zod
```

Both providers follow the same interface, so our analysis service can work with either.

## 4. Main files

| File | Responsibility |
|---|---|
| `ai-provider.ts` | Defines what an AI provider must be able to do |
| `gemini-ai-provider.ts` | Sends real requests to Gemini and returns the response |
| `mock-ai-provider.ts` | Returns predefined responses without contacting Gemini |
| `mock-ai-provider.test.ts` | Tests the mock provider |
| `gemini-ai-provider.manual.ts` | Demonstrates a real Gemini request |

The manual script requires a configured Gemini API key and uses API quota when executed.

## 5. What is an interface?

An interface is a TypeScript definition that describes what an object must provide.

Our `AIProvider` interface looks like this:

```ts
export interface AIProvider {
  analyzeFeedback(feedback: string): Promise<string>;
}
```

This means any provider must have an `analyzeFeedback()` method that:

1. Accepts a feedback string.
2. Performs the analysis.
3. Returns a promise containing a string.

A promise represents a result that will become available later, such as after an API request.

The interface doesn't specify **how** the analysis happens.

That is the