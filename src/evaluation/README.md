# Evaluation — Checking AI Response Quality

**Chapter 2 — Testing and Evaluating AI**

## 1. What does this folder do?

The `evaluation/` folder helps us check whether our AI-generated feedback analysis is accurate and useful.

For example, Gemini might analyse this feedback:

"My manager never listens to my concerns."

And return:

```json
{
  "sentiment": "positive",
  "themes": ["management"],
  "priority": "low",
  "summary": "The employee is happy with management."
}
```

The JSON is correctly structured, but the analysis is clearly wrong.

**Evaluation helps us detect problems like this.**

## 2. Why do we need evaluation?

Traditional software often produces predictable results.

AI models are different. The same question can sometimes produce different answers.

We therefore need ways to check the quality of AI responses, not just whether our code runs successfully.

Our project uses four approaches:

- **Deterministic evaluation:** Checks expected values using normal TypeScript rules.
- **Summary evaluation:** Checks whether important themes appear in the summary.
- **Semantic evaluation:** Uses embeddings to compare meanings.
- **LLM-as-a-Judge:** Uses another AI request to assess the response.

Each approach checks something different.

## 3. How does it work?

```text
Original employee feedback
         +
AI-generated analysis
         ↓
evaluateAnalysis()
         │
         ├── evaluateFeedback()
         │      Checks sentiment, priority, themes
         │
         ├── evaluateSummary()
         │      Checks summary wording
         │
         ├