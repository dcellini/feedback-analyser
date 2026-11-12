# Grounding — Verifying AI Answers

**Chapter 7 — Grounded Answers and Verification**

## 1. What does this folder do?

The `grounding/` folder helps us check whether an AI-generated answer is supported by the employee feedback we supplied.

AI models can sometimes produce convincing answers containing incorrect information. This is often called **hallucination**.

Grounding helps us detect certain types of unsupported claims.

For example, Gemini might say:

"Five employees complained about parking."

But our feedback only contains three parking complaints.

Our verification code can help identify this discrepancy.

## 2. Why do we need grounding?

RAG and AI tools allow Gemini to access relevant feedback.

However, providing information to Gemini doesn't guarantee it will interpret that information correctly.

We therefore introduced additional checks to verify parts of the generated answer.

Our current implementation focuses on:

- **Source references:** Does the referenced feedback actually exist?
- **Quotations:** Does the quoted text appear in the referenced feedback?
- **Numerical claims:** Are supported numerical statements consistent with the evidence?

These checks help us identify problems before accepting an AI-generated answer.

## 3. How does it work?

```text
Employee feedback evidence
          +
AI-generated answer
          ↓
validateGroundedAnswer()
          │
          ├── Validate answer structure
          │
          ├── Check source references
          │
          ├── Verify feedback quotations
          │
          └── Verify supported numerical claims
          ↓
Verification result
```

The main function coordinates the checks and reports whether the answer passes the implemented validation rules.

## 4. Folder structure

```text
grounding/
├── README.md
├── validate-grounded-answer.ts
├── validate-grounded-answer.test.ts
├── grounded-answer-schema.ts
├── validate-numerical-answer.test.ts
│
└── internal/
    ├── verify-grounded-claim.ts
    ├── verify-grounded-claim.test.ts
    ├── verify-feedback-quote.ts
    ├── verify-feedback-quote.test.ts
    ├── verify-numerical-claim.ts
    └── verify-numerical-claim.test.ts
```

The main workflow stays at the root. Supporting verification functions live in `internal/`.

## 5. Main files

| File | Responsibility |
|---|---|
| `validate-grounded-answer.ts` | Main entry point that coordinates verification |
| `grounded-answer-schema.ts` | Defines the expected structure of an AI-generated answer |
| `validate-numerical-answer.test.ts` | Tests numerical-answer verification behaviour |
| `internal/verify-grounded-claim.ts` | Checks individual claims against supported evidence |
| `internal/verify-feedback-quote.ts` | Checks quotations against the original feedback |
| `internal/verify-numerical-claim.ts` | Checks supported numerical claims |

**Start with:** `validate-grounded-answer.ts`, followed by `grounded-answer-schema.ts`.

## 6. What is a grounded answer?

A grounded answer is one that is supported by available evidence.

For example, imagine we have these feedback comments:

```text
feedback-001:
"The office parking is inadequate."

feedback-002:
"We need more parking spaces."
```

An answer stating that employees have raised concerns about parking is supported by these comments.

An answer stating that 20 employees complained about parking would not be supported by these two comments alone.

Our goal is to make AI responses more trustworthy by checking what we can against the supplied evidence.

## 7. What does the schema do?

`grounded-answer-schema.ts` defines the structure we expect from an AI-generated answer.

It distinguishes between an answer that has been provided and a situation where there is insufficient evidence.

For example, an AI may need to indicate:

```text
Status: insufficient_evidence
```

Rather than inventing an answer when the available feedback cannot support one.

The schema checks the shape of the response. Other verification functions check specific claims against the evidence.

**A correctly structured answer is not necessarily a correct answer.**

## 8. How does this connect to the rest of our application?

**`embeddings/`**

Finds feedback relevant to a question.

**`rag/`**

Uses retrieved feedback to generate an AI answer.

**`tools/`**

Allows an AI agent to request information and generate responses.

**`grounding/`**

Checks whether parts of the generated answer are supported by the supplied evidence.

For example:

```text
Question
   ↓
AI agent searches feedback
   ↓
AI generates an answer
   ↓
grounding/
   ↓
Verify sources and claims
   ↓
Accept or flag the answer
```

Grounding provides reusable checks rather than controlling the entire AI workflow.

## 9. How is grounding different from evaluation?

**Evaluation** asks:

"How good is the AI's analysis overall?"

**Grounding** asks:

"Can we verify the evidence supporting this particular answer?"

Evaluation can compare outputs against expected examples or use an AI judge.

Grounding uses programmed checks against the evidence available for a specific response.

Both help improve reliability, but they serve different purposes.

## 10. What am I learning?

**Grounding:** Connecting AI-generated claims to supporting evidence.

**Runtime validation:** Checking that generated data follows the expected structure.

**Source verification:** Ensuring referenced feedback exists.

**Quote verification:** Checking that quoted text appears in the evidence.

**Numerical verification:** Checking supported numerical statements against available data.

**Separation of concerns:** Keeping verification logic independent of the AI model that generated the answer.

## 11. Current limitations

Our implementation does not prove that every AI-generated statement is true.

For example:

- A genuine quotation can still be interpreted incorrectly.
- A valid source reference doesn't guarantee that the source supports the conclusion.
- Not every type of numerical statement is supported by our checks.
- More complex claims may require additional verification.

Grounding reduces certain risks but doesn't eliminate hallucinations.

## 12. Things to remember

- RAG provides relevant information; grounding checks how the AI uses it.
- `validateGroundedAnswer()` is the main verification workflow.
- The schema checks answer structure.
- Supporting functions check sources, quotations and numerical claims.
- Grounding can detect some unsupported statements, but not every mistake.
- Tests allow us to verify this behaviour without making real Gemini requests.

**In one sentence:** The grounding folder provides reusable checks to help ensure AI-generated answers are supported by the available employee feedback.