# Feedback Analyser — Learning Notes

This document records the important concepts learned while building the Feedback Analyser.

The goal is not to document every line of code. It is to capture the **important ideas, patterns and reasons behind the architecture** so they can be revisited later.

The learning approach is:

**Build → understand → document → move on**

---

# 1. TypeScript vs Runtime Validation

One of the most important concepts in this project is the difference between TypeScript types and runtime validation.

## TypeScript

TypeScript protects assumptions while writing and compiling the code.

For example:

```ts
type FeedbackAnalysis = {
  sentiment: "positive" | "negative" | "neutral";
  themes: string[];
  priority: "low" | "medium" | "high";
  summary: string;
};
```

This helps TypeScript understand what our code expects.

However, TypeScript types do **not** exist when the JavaScript application is running.

They cannot protect us from data coming from an API.

## Zod

Zod performs validation at runtime.

```ts
feedbackAnalysisSchema.parse(data);
```

This checks the actual value that arrived.

The important mental model is:

```text
TypeScript
    ↓
Protects assumptions inside our code

Zod
    ↓
Protects us from external data
```

This matters especially for AI because we cannot assume that an LLM will always return exactly what we asked for.

---

# 2. AI Output Is Untrusted

A major principle from this project:

> Treat AI output like external user input.

Even when we ask an AI model for structured JSON, the response can still be:

* malformed
* incomplete
* the wrong type
* missing fields
* unexpected content
* technically valid JSON but the wrong structure

Therefore our application does not simply trust the result.

The trust boundary is:

```text
External AI
    ↓
Raw response
    ↓
JSON.parse()
    ↓
unknown
    ↓
Zod validation
    ↓
Trusted application data
```

This is an important AI engineering pattern.

---

# 3. Why JSON.parse() Produces `unknown`

After receiving JSON from an external source, we should not pretend we already know its shape.

For example:

```ts
const parsed: unknown = JSON.parse(result);
```

`unknown` effectively means:

> "There is a value here, but we haven't proved what it is yet."

We then use Zod to establish what it actually is:

```ts
const analysis = feedbackAnalysisSchema.parse(parsed);
```

After successful validation, we can safely treat it as a `FeedbackAnalysis`.

This gives us a useful boundary:

```text
unknown
   ↓
validate
   ↓
known and trusted type
```

---

# 4. Zod Schema and TypeScript Type Can Share One Source

Instead of defining the same structure twice, we use Zod to create the runtime schema and derive the TypeScript type from it.

```ts
export const feedbackAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  themes: z.array(z.string()),
  priority: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});

export type FeedbackAnalysis = z.infer<typeof feedbackAnalysisSchema>;
```

The relationship is:

```text
Zod schema
    ↓
z.infer
    ↓
FeedbackAnalysis TypeScript type
```

This reduces the chance that the runtime validation and TypeScript definition become inconsistent.

---

# 5. Interfaces Are Contracts

Our `AIProvider` interface is:

```ts
interface AIProvider {
  analyzeFeedback(feedback: string): Promise<string>;
}
```

The interface says:

> Anything acting as an AI provider must have this method with this input and output contract.

It does **not** say how the provider works.

That allows us to have:

```text
AIProvider
   ├── Mock provider
   └── Gemini provider
```

The application only needs to know about `AIProvider`.

It does not need to know about Gemini.

This is useful because we can change the underlying AI service without changing the application logic.

---

# 6. Why AIProvider Returns `string` Instead of `FeedbackAnalysis`

An important architectural decision was to **not** define the provider as:

```ts
Promise<FeedbackAnalysis>
```

That would imply the provider guarantees that the AI response is already valid.

It doesn't.

The real flow is:

```text
Gemini
   ↓
JSON string
   ↓
Application parses it
   ↓
Zod validates it
   ↓
FeedbackAnalysis
```

Therefore the provider returns:

```ts
Promise<string>
```

The application service owns validation.

This means every provider passes through the same trust boundary.

---

# 7. Dependency Injection

The `feedbackAnalyser` receives its provider:

```ts
feedbackAnalyser({
  feedback,
  aiProvider,
});
```

Rather than creating the provider internally.

This is dependency injection.

The function says:

> "Give me something that can analyse feedback."

It doesn't care whether that thing is:

* Gemini
* a mock
* another AI provider
* something we create in the future

This makes the code easier to test and keeps application logic separate from infrastructure.

Mental model:

```text
Application logic
       ↓
     AIProvider
     ↙       ↘
   Mock     Gemini
```

---

# 8. Adapter / Provider Boundary

The Gemini provider contains Gemini-specific details:

* API URL
* API key
* request format
* Gemini model
* response structure
* extracting model output
* API error handling

The application service does not need to know any of that.

The provider acts as a boundary between:

```text
Our application
      ↕
AI provider API
```

This is useful because external APIs change and are implementation details.

---

# 9. Why the Mock Provider Exists

The mock provider lets us test the application without calling a real AI service.

For example:

```ts
const provider = createMockAIProvider({
  sentiment: "negative",
  themes: ["performance reviews"],
  priority: "medium",
  summary: "Mock analysis",
});
```

The test now controls exactly what the AI is supposed to return.

This gives us predictable tests.

The mock is **not pretending to be intelligent**.

It simply gives us a controlled response.

Mental model:

```text
Real provider
    → real AI

Mock provider
    → controlled result
```

---

# 10. Why the Mock Factory Is Synchronous but Its Method Is Async

Creating the mock does not involve asynchronous work:

```ts
createMockAIProvider(config)
```

So the factory itself is synchronous.

But the real provider has:

```ts
async analyzeFeedback(...)
```

because it makes an HTTP request.

The mock therefore keeps the same asynchronous contract:

```ts
async analyzeFeedback(...)
```

This means application code can treat both providers in exactly the same way.

---

# 11. `vi.fn()` and Mocks

Vitest provides `vi.fn()` for creating mock functions.

Example:

```ts
const mockAIProvider = {
  analyzeFeedback: vi.fn().mockResolvedValue(
    JSON.stringify({
      sentiment: "negative",
      themes: ["performance reviews"],
      priority: "medium",
      summary: "Mock analysis",
    }),
  ),
};
```

This lets us control the result and also inspect how the function was used.

For example:

```ts
expect(mockAIProvider.analyzeFeedback)
  .toHaveBeenCalledWith(feedback);
```

So we can test both:

```text
Did the function return the right thing?
        AND
Was the dependency called correctly?
```

---

# 12. Testing External APIs Without Calling Them

We use:

```ts
vi.stubGlobal("fetch", ...)
```

to replace the real `fetch` function in tests.

This allows us to simulate:

```text
Successful API response
HTTP error
Invalid AI output
Missing output
```

without making a real Gemini request.

This is important because automated tests should be:

* fast
* predictable
* repeatable
* independent of network access
* independent of API quotas

We use the same principle for the Gemini LLM judge.

---

# 13. Testing Async Code

When testing asynchronous functions, we use `async` / `await`.

For successful results:

```ts
const result = await provider.analyzeFeedback(...);
```

For errors:

```ts
await expect(
  provider.analyzeFeedback(...)
).rejects.toThrow();
```

The important thing to remember is that an async function returns a Promise.

So the test needs to wait for that Promise to resolve or reject.

---

# 14. `describe`, `it` and `expect`

Vitest basics:

### `describe`

Groups related tests.

```ts
describe("feedbackAnalyser", () => {
  ...
});
```

Think:

> "These tests are about this thing."

### `it`

Describes one behaviour we want to test.

```ts
it("returns the analysis", () => {
  ...
});
```

Think:

> "This should happen."

### `expect`

Makes an assertion about the result.

```ts
expect(result).toEqual(expected);
```

Think:

> "I expect this result."

---

# 15. `as const`

We use `as const` in some test fixtures.

For example:

```ts
const expected = {
  sentiment: "negative",
  priority: "medium",
} as const;
```

Without `as const`, TypeScript may infer these values as general `string` values.

With `as const`, it keeps the specific literal values:

```text
"negative"
"medium"
```

rather than:

```text
string
```

This becomes particularly useful when creating test fixtures that need to match narrow union types.

---

# 16. Deterministic Evaluation

Not every part of AI output needs an LLM to evaluate it.

Some things can be checked with normal code.

For example:

```ts
actual.sentiment === expected.sentiment
```

or:

```ts
actual.themes.includes(theme)
```

Our deterministic evaluator currently checks things such as:

* sentiment
* priority
* required themes

These checks are:

* fast
* cheap
* predictable
* easy to understand

This is useful because we should use traditional code where traditional code is good enough.

---

# 17. Why Deterministic Evaluation Isn't Enough

AI output isn't always easy to compare exactly.

For example, these could both be reasonable:

```text
"management"
```

and:

```text
"manager communication"
```

A simple string comparison might say they are different even though the meaning is similar.

Likewise, a good summary may use different wording from the expected answer.

This is one reason we introduced an LLM judge.

---

# 18. LLM-as-a-Judge

The idea is to use one LLM to evaluate the output of another LLM.

The judge receives:

```text
Original feedback
        +
AI-generated analysis
```

and evaluates qualities such as:

* sentiment accuracy
* important themes
* priority
* summary quality
* unsupported information

The judge returns:

```ts
{
  passed: boolean;
  score: number;
  reasoning: string;
}
```

This is fundamentally different from exact string matching.

Instead of asking:

> "Does the answer exactly match my expected answer?"

we ask:

> "Is this answer a good representation of the original feedback?"

---

# 19. The LLM Judge Is Also Untrusted

An important extension of the earlier trust principle:

The judge is itself an AI system.

Therefore we do not automatically trust its response.

The judge follows the same basic pattern:

```text
Gemini
   ↓
JSON string
   ↓
JSON.parse()
   ↓
unknown
   ↓
Zod validation
   ↓
JudgeResult
```

So the evaluator itself needs validation.

---

# 20. Prompt vs API Integration

We separated the judge prompt from the Gemini API code.

`judge-prompt.ts` decides:

> What should the judge evaluate?

`gemini-llm-judge.ts` decides:

> How do we send that request to Gemini and interpret the response?

This separation keeps responsibilities clearer.

Mental model:

```text
Judge behaviour
      ↓
   Prompt

Judge implementation
      ↓
 Gemini API
```

This will become increasingly useful as prompts become more sophisticated.

---

# 21. Why We Have Both Deterministic and LLM Evaluation

The two approaches complement each other.

```text
              AI output
                  ↓
         ┌────────┴────────┐
         ↓                 ↓
 Deterministic          LLM judge
   checks                meaning
         ↓                 ↓
 exact/simple          subjective/semantic
```

The goal isn't to choose one and ignore the other.

A useful evaluation system can combine several techniques.

---

# 22. Mocks vs Real AI

A mock tells us:

> "What happens when this dependency gives my application this result?"

A real AI call tells us:

> "What does the actual model produce?"

These are different questions.

Tests should primarily use mocks.

Manual/integration runs can use the real provider.

This is why we have:

```text
gemini-ai-provider.ts
```

and:

```text
gemini-ai-provider.manual.ts
```

The automated tests remain independent of Gemini.

---

# 23. What We Have Learned About AI Engineering

So far, the project has moved beyond simply:

> "Call an LLM and print the answer."

We have already introduced several important AI engineering ideas:

```text
LLM
 ↓
Structured output
 ↓
Runtime validation
 ↓
Application logic
 ↓
Evaluation
 ↓
LLM-as-a-judge
```

The important shift is thinking about the **whole system around the model**, not just the model call.

---

# 24. Important Architecture Principle

A useful general rule from this project is:

> Keep AI-specific details at the boundaries.

Our application should not become tightly coupled to Gemini.

Instead:

```text
Application
     ↓
Interface
     ↓
Provider
     ↓
External AI
```

This makes it easier to:

* test
* replace providers
* compare models
* change APIs
* introduce different AI implementations

---

# 25. Current Limitations

The current project is intentionally simple.

Some of the things we have built are demonstrations rather than production-quality solutions.

For example:

* theme matching is currently simplistic
* summary evaluation is currently based on wording rather than meaning
* the evaluation dataset is small
* the LLM judge itself can make mistakes
* we have not yet explored judge calibration
* we have not yet compared multiple models
* there is no persistence or user interface
* there are no production cloud components yet

These limitations are useful because they give us clear areas to improve as we learn.

---

# 26. Next Learning Areas

The next stages will build on what we already have.

Likely areas include:

### Evaluation

Learn how to build stronger datasets, regression tests and more reliable evaluation strategies.

### Embeddings

Understand how text can be converted into vectors representing meaning.

### Vector search

Use embeddings to find semantically similar feedback.

### RAG

Combine retrieval with an LLM so the model can answer using relevant information rather than relying only on its own context.

### Tool / function calling

Allow an AI model to request actions or retrieve information through controlled application functions.

### Agents

Explore workflows where an LLM can reason through multiple steps and use tools.

### AI security

Look at prompt injection, data leakage, access control, sensitive information and other risks.

### Production AI systems

Explore:

* retries
* rate limits
* observability
* cost
* latency
* caching
* background processing
* queues
* AWS architecture

---

# 27. Core Mental Models to Remember

These are the main ideas worth remembering from this stage.

### TypeScript vs Zod

```text
TypeScript → compile-time protection
Zod        → runtime protection
```

### AI trust boundary

```text
AI output → unknown → validate → trusted data
```

### Provider abstraction

```text
Application → AIProvider → Gemini
                         → Mock
```

### Dependency injection

```text
Give the function its dependency
rather than making it create the dependency itself.
```

### Testing

```text
Control the dependency
      ↓
Give it a known result
      ↓
Check our code behaves correctly
```

### Evaluation

```text
Use code for things code can judge.
Use an LLM where meaning requires judgement.
```

---

# 28. Learning Philosophy

The purpose of this project is to become better at **building software that uses AI reliably**, not simply becoming better at prompting.

The emphasis is on:

* software engineering
* architecture
* testing
* reliability
* evaluation
* integration
* security
* practical AI capabilities

The aim is to reach the point where an AI feature feels like a normal software engineering problem with some additional challenges around uncertainty, evaluation and external model behaviour.

**Build → understand → document → move on.**

Separating orchestration from implementation
Orchestration is code that coordinates multiple operations without needing to know their implementation details.
Our runEvaluation() function coordinates:
1. Generating an AI analysis.
2. Validating the response.
3. Evaluating its quality.
4. Collecting the results.
It receives AIProvider and LLMJudge as dependencies rather than creating Gemini implementations internally.
This means the same evaluation workflow works with mocks or real AI providers, making it easier to test, maintain and extend.
              runEvaluation()
                    |
          +---------+---------+
          |                   |
      AIProvider           LLMJudge
       /    \               /    \
     Mock  Gemini         Mock  Gemini


Key takeaway: Separate what the application needs to do from how its dependencies perform those operations.
We'll keep using this approach: build the functionality, explain important decisions, and flag genuinely valuable lessons for your notes.


## Readonly Arrays in TypeScript

TypeScript distinguishes between mutable and readonly arrays.

```ts
const themes: readonly string[] = ["management", "communication"];
```

A readonly array can be read but cannot be modified through that reference using methods such as `.push()` or `.splice()`.

### Why we encountered this

Our evaluation fixtures use `as const`, which makes their arrays readonly.

However, `evaluateSummary()` originally expected a mutable array:

```ts
requiredThemes: string[]
```

TypeScript rejected passing a readonly array into a function that could potentially modify it.

### The solution

```ts
requiredThemes: readonly string[]
```

Our evaluator only reads the array using `.every()`, so it has no reason to require a mutable array.

A function accepting `readonly string[]` can receive both mutable and readonly arrays.

**Key takeaway:** Prefer `readonly` for array parameters when the function doesn't need to modify the array. This makes the function more flexible and communicates that it won't mutate the caller's data.


## False Negatives in AI Evaluation

Our first real evaluation produced an interesting result:

- Deterministic evaluation: Failed
- Summary evaluation: Failed
- LLM judge: Passed (score 1.0)

The generated analysis appeared reasonable, but our evaluators
rejected it because they relied on exact wording.

### The problem

Expected theme: `management`

Actual theme: `management support`

These have closely related meanings, but JavaScript's array
`.includes()` requires an exact element match.

Similarly, a summary can accurately describe employee recognition
without using the literal word "recognition".

### Key lessons

1. A failed evaluation doesn't necessarily mean the AI was wrong.
2. Evaluation methods can produce false positives and false negatives.
3. Exact matching works well for constrained values such as sentiment.
4. Semantic concepts often require more flexible evaluation methods.
5. An LLM judge can help, but its judgement is not guaranteed correct.

**Key takeaway:** Evaluating AI output requires evaluating the
quality of our evaluation methods, not just the model's answers.


## Embeddings and Cosine Similarity

### What is an embedding?

An embedding is a numerical representation of something,
such as a word, sentence or document.

An embedding model converts text into a vector (an array of numbers).

For example (invented numbers):

```ts
"management"         → [0.8, 0.6, 0.1]
"management support" → [0.9, 0.5, 0.1]
"office parking"     → [0.1, 0.2, 0.9]
```

The idea is that related meanings are generally represented
by vectors that are closer together or point in similar directions.

Real embedding models produce much larger vectors.

### What is cosine similarity?

Cosine similarity compares the direction of two vectors.

It returns a number between -1 and 1:

- `1` = same direction
- `0` = perpendicular directions
- `-1` = opposite directions

```ts
cosineSimilarity([1, 0], [1, 0]);  // 1
cosineSimilarity([1, 0], [0, 1]);  // 0
cosineSimilarity([1, 0], [-1, 0]); // -1
```

### How is it calculated?

1. Calculate the dot product (multiply corresponding values and add).
2. Calculate the magnitude (length) of each vector.
3. Divide the dot product by the product of the magnitudes.

Example:

```ts
const a = [3, 4];
const b = [6, 8];

// Dot product = (3 × 6) + (4 × 8) = 50
// Magnitude A = √(3² + 4²) = 5
// Magnitude B = √(6² + 8²) = 10
//
// Cosine similarity = 50 / (5 × 10) = 1
```

The vectors have different lengths, but point in the
same direction, so their similarity is 1.

### How does this help our Feedback Analyser?

Previously:

```ts
["management support"].includes("management"); // false
```

This fails because the strings aren't identical.

With embeddings, we can instead:

1. Convert "management" into a vector.
2. Convert "management support" into a vector.
3. Calculate their cosine similarity.
4. Decide whether their similarity is high enough to
   consider the themes related.

### Important limitations

- Cosine similarity doesn't understand language by itself.
- The embedding model provides the meaningful numerical representations.
- High similarity doesn't guarantee two statements mean the same thing.
- We must test and choose an appropriate similarity threshold.
```


## Comparing Text Using Embeddings

Our `compareText()` function combines two responsibilities:

1. `EmbeddingProvider.embed()` converts each text into a vector.
2. `cosineSimilarity()` compares those vectors.

```ts
const [embeddingA, embeddingB] = await Promise.all([
  embeddingProvider.embed(textA),
  embeddingProvider.embed(textB),
]);

return cosineSimilarity(embeddingA, embeddingB);
```

### Why use Promise.all()?

Both embedding requests are independent.

`Promise.all()` starts them concurrently rather than waiting
for the first request to finish before starting the second.

If either operation rejects, the combined promise rejects.

### Why inject EmbeddingProvider?

Our comparison function doesn't need to know how embeddings
are generated.

- Tests use a mock provider with predictable vectors.
- Production can use Gemini or another embedding model.

This keeps the comparison logic independent of external APIs.

### Important

Mock embeddings only test our software's behaviour.
They do not prove that a real model understands the text correctly.

## Caching Embeddings

Generating embeddings can require an external API request.

When comparing multiple text strings, the same text may
appear in several comparisons.

We can use a `Map` to store previously generated embeddings.

```ts
const cache = new Map<string, number[]>();

const getEmbedding = async (text: string): Promise<number[]> => {
  const cached = cache.get(text);

  if (cached !== undefined) {
    return cached;
  }

  const embedding = await embeddingProvider.embed(text);
  cache.set(text, embedding);

  return embedding;
};
```

### Example

Expected themes:
- management
- recognition

Actual themes:
- management support
- recognition

Without caching:
- 4 comparisons × 2 embeddings = 8 embedding operations.

With caching:
- Only 3 unique strings = 3 embedding operations.

### Why use a Map?

A Map stores key/value pairs.

- Key: the original text.
- Value: its numerical embedding.

`cache.get(text)` retrieves an existing embedding.

`cache.set(text, embedding)` stores a new embedding.

### Important limitations

- This cache exists only for one evaluation.
- A new evaluation starts with an empty cache.
- Sequential access avoids duplicate requests here.
- Concurrent requests would need additional handling to
  avoid generating the same embedding simultaneously.
- Embeddings should not be reused across different models
  or model versions without considering compatibility.

**Key takeaway:** Generate expensive results once and reuse
them when the same inputs are needed again.


## Semantic Search

Semantic search finds text based on similarity of meaning
rather than requiring exact keyword matches.

### How it works

1. Convert the search query into an embedding.
2. Convert each feedback response into an embedding.
3. Compare the query vector with each feedback vector.
4. Sort by cosine similarity (highest first).
5. Return the top results.

Example:

```ts
const results = await semanticSearch({
  query: "Problems with leadership",
  feedback: [
    { id: "1", text: "My manager ignores my concerns." },
    { id: "2", text: "The office needs better parking." },
  ],
  embeddingProvider,
  limit: 2,
});
```

### Why use Promise.all()?

Each feedback embedding is independent, so we can
generate them concurrently instead of sequentially.

This works well for small collections, but real APIs
may need batching or concurrency limits.

### Current limitation

Our implementation generates every feedback embedding
again each time we search.

A production application would normally:

- Generate feedback embeddings when feedback is added.
- Store them alongside the original feedback.
- Generate only the search query embedding at search time.
- Compare against the stored embeddings.

This is the foundation of vector search and RAG.


## Preparing and Caching Embeddings for Search

Our original semantic search generated embeddings for every
feedback response every time someone searched.

This is inefficient because the feedback usually doesn't
change between searches.

### What is caching?

Caching means storing the result of an operation so we can
reuse it instead of performing the same work again.

Generating embeddings can involve an external AI API,
which takes time and may cost money or consume API quota.

If the feedback text hasn't changed, its embedding can
usually be reused.

### How our implementation creates a cache

We aren't using a traditional cache such as a Map or Redis.

Instead, we **precompute embeddings and store them in an
array alongside the original feedback**.

This effectively acts as an in-memory embedding cache.

**Step 1 — Prepare the feedback once**

```ts
const preparedFeedback = await prepareFeedback({
  feedback,
  embeddingProvider,
});
```

Internally, `prepareFeedback()` calls the embedding provider
for each response:

```ts
const embedding = await embeddingProvider.embed(item.text);

return {
  ...item,
  embedding,
};
```

Example result:

```ts
[
  {
    id: "1",
    text: "My manager ignores my concerns.",
    embedding: [0.9, 0.1],
  },
  {
    id: "2",
    text: "The office needs better parking.",
    embedding: [0, 1],
  },
]
```

The embeddings are now stored in `preparedFeedback`.

**Step 2 — Reuse those embeddings when searching**

```ts
const results = await semanticSearch({
  query: "Problems with leadership",
  feedback: preparedFeedback,
  embeddingProvider,
});
```

Inside `semanticSearch()`:

```ts
const queryEmbedding = await embeddingProvider.embed(query);

const results = feedback.map((item) => ({
  id: item.id,
  text: item.text,
  similarity: cosineSimilarity(
    queryEmbedding,
    item.embedding,
  ),
}));
```

Notice that `item.embedding` already exists.

We don't call `embeddingProvider.embed(item.text)` again.

**Step 3 — Search again using the same prepared feedback**

```ts
const secondResults = await semanticSearch({
  query: "Office facilities",
  feedback: preparedFeedback,
  embeddingProvider,
});
```

We generate an embedding for the new query, but reuse
the same feedback embeddings.

### Why is this better?

For 1,000 feedback responses and 10 searches:

**Without reuse:**
- 1,000 feedback embeddings per search.
- 10 query embeddings.
- Total: 10,010 embedding operations.

**With precomputed embeddings:**
- 1,000 feedback embeddings generated once.
- 10 query embeddings.
- Total: 1,010 embedding operations.

That's approximately 90% fewer embedding operations.

### Is this a real cache?

It provides the benefit of caching, but it's more accurately
described as **precomputed embeddings stored in memory**.

Unlike a traditional cache:

- There is no automatic lookup by text.
- Calling `prepareFeedback()` again regenerates everything.
- The data disappears when the application restarts.
- We must explicitly pass `preparedFeedback` into searches.

A production system could persist these embeddings in a
database or vector store and only regenerate them when
the feedback or embedding model changes.

### Key takeaway

**Generate expensive embeddings once, store the results,
and reuse them whenever the original text hasn't changed.**

Our `preparedFeedback` array is effectively an in-memory
cache of previously calculated embeddings.


## Caching Embeddings with Map

A cache stores the result of an expensive operation so we
can reuse it instead of performing the same work again.

In our Feedback Analyser, generating embeddings may involve
calling an external AI API. Caching helps avoid unnecessary
API requests, reduces latency and saves money.

### 1. What is a JavaScript Map?

A `Map` is a built-in JavaScript data structure that stores
key-value pairs.

Unlike an ordinary object, a Map is specifically designed
for adding, retrieving and removing entries using keys.

```ts
const cache = new Map<string, number[]>();

// Add entries
cache.set("management", [0.9, 0.1]);
cache.set("recognition", [0.1, 0.9]);

// Retrieve an entry
cache.get("management"); // [0.9, 0.1]

// Check whether a key exists
cache.has("management"); // true

// Remove one entry
cache.delete("management");

// Number of entries
cache.size; // 1

// Remove all entries
cache.clear();
```

The TypeScript definition:

`Map<string, number[]>`

means:

- `string` — the key, such as `"management"`.
- `number[]` — the value, such as `[0.9, 0.1]`.

Our Map might contain:

| Key | Value |
|---|---|
| `"management"` | `[0.9, 0.1]` |
| `"recognition"` | `[0.1, 0.9]` |

Map lookups are generally efficient, making them useful
for caching previously calculated results.

### 2. How our embedding cache works

We created `createCachedEmbeddingProvider()` to wrap an
existing embedding provider.

File: `src/embeddings/cached-embedding-provider.ts`

```ts
export const createCachedEmbeddingProvider = (
  provider: EmbeddingProvider,
): EmbeddingProvider => {
  // Created once for this cached provider instance.
  const cache = new Map<string, number[]>();

  return {
    async embed(text: string): Promise<number[]> {
      // STEP 1: Look for an existing embedding.
      const cached = cache.get(text);

      // STEP 2: Return it if already stored.
      if (cached !== undefined) {
        return cached;
      }

      // STEP 3: Otherwise generate the embedding.
      const embedding = await provider.embed(text);

      // STEP 4: Store it for future requests.
      cache.set(text, embedding);

      return embedding;
    },
  };
};
```

#### Worked example

First request:

```ts
await cachedProvider.embed("management");
```

1. `cache.get("management")` returns `undefined`.
2. This is a **cache miss**.
3. The underlying provider generates `[0.9, 0.1]`.
4. We store `"management" → [0.9, 0.1]`.
5. Return the embedding.

Second request:

```ts
await cachedProvider.embed("management");
```

1. `cache.get("management")` returns `[0.9, 0.1]`.
2. This is a **cache hit**.
3. Return the stored embedding immediately.
4. The underlying provider is not called.

This is a basic form of the **cache-aside pattern**:
check the cache first, and calculate a missing value
before storing it for future use.

### 3. How does the Map persist between function calls?

The Map is declared inside `createCachedEmbeddingProvider()`
but outside the returned `embed()` method.

```ts
const createCachedEmbeddingProvider = (provider) => {
  const cache = new Map(); // Created once

  return {
    async embed(text) {
      // Reuses the SAME Map on every call.
      const cached = cache.get(text);
    },
  };
};
```

When we create a provider:

```ts
const cachedProvider = createCachedEmbeddingProvider(provider);
```

JavaScript creates a new Map and returns an object containing
an `embed()` method.

Even though `createCachedEmbeddingProvider()` has finished
executing, the returned method still has access to its Map.

This happens because of a JavaScript concept called a
**closure**.

### 4. What is a closure?

A closure means a function retains access to variables
from the scope where it was created, even after the
outer function has returned.

A simple example:

```ts
const createCounter = () => {
  let count = 0;

  return () => {
    count++;
    return count;
  };
};

const counter = createCounter();

counter(); // 1
counter(); // 2
counter(); // 3
```

Why doesn't `count` reset to zero?

Because `createCounter()` runs once when we create `counter`.

The returned function retains access to the original
`count` variable through a closure.

Each subsequent call updates that same variable.

Our embedding cache works in exactly the same way:

- `createCounter()` retains a number.
- `createCachedEmbeddingProvider()` retains a Map.

The Map remains accessible to `embed()` between calls.

### 5. Does the Map persist forever?

No. A Map exists in the application's memory while it
remains reachable.

It does not automatically save anything to disk.

| Situation | Does the cache survive? |
|---|---|
| Calling `embed()` again on the same instance | Yes |
| Using the same provider in another function | Yes |
| Creating a new cached provider | No — separate empty cache |
| Restarting the Node.js process | No |
| Starting another application instance | No shared cache |
| Cache becomes unreachable | Eligible for garbage collection |

For example:

```ts
const providerA = createCachedEmbeddingProvider(provider);
const providerB = createCachedEmbeddingProvider(provider);

await providerA.embed("management"); // Cache miss
await providerA.embed("management"); // Cache hit

await providerB.embed("management"); // Cache miss
```

`providerA` and `providerB` each have their own Map.

This is why we should generally create our cached provider
once and reuse that instance throughout the relevant workflow.

### 6. In-memory caching vs persistent caching

Our Map cache is an **in-memory cache**.

It is fast and requires no external dependencies, but its
contents disappear when the Node.js process restarts.

For persistent or shared caching, we could use:

- **Map:** Simple in-memory caching within one process.
- **LRU cache:** In-memory caching with size limits and
  optional expiry, such as the `lru-cache` npm package.
- **Redis:** A separate cache service that can be shared
  across application instances and configured for persistence.
- **Database:** Store embeddings persistently so they can
  be reused after application restarts.

For our learning project, Map is sufficient.

### 7. Map cache vs precomputed embeddings

We now have two related but different approaches.

**Precomputed embeddings (`prepareFeedback()`):**

```ts
const preparedFeedback = await prepareFeedback({
  feedback,
  embeddingProvider,
});
```

- Generates embeddings upfront.
- Stores them alongside the original feedback.
- Passes the prepared data into subsequent searches.
- Doesn't automatically check whether text was embedded before.

**Map cache (`createCachedEmbeddingProvider()`):**

```ts
const cachedProvider = createCachedEmbeddingProvider(provider);

await cachedProvider.embed("management"); // Cache miss
await cachedProvider.embed("management"); // Cache hit
```

- Generates embeddings when requested.
- Automatically checks for an existing result.
- Stores embeddings by their original text.
- Avoids repeated work for identical text.

They can be used together:

```ts
const cachedProvider = createCachedEmbeddingProvider(provider);

const preparedFeedback = await prepareFeedback({
  feedback,
  embeddingProvider: cachedProvider,
});

const results = await semanticSearch({
  query: "Problems with leadership",
  feedback: preparedFeedback,
  embeddingProvider: cachedProvider,
});
```

If we call `prepareFeedback()` again with the same cached
provider and identical feedback text, the underlying
embedding provider won't need to regenerate those embeddings.

### 8. Why use a wrapper?

Both the original provider and our cached provider implement
the same `EmbeddingProvider` interface.

This means functions such as `compareText()`,
`prepareFeedback()` and `semanticSearch()` don't need
to know whether caching is enabled.

This is an example of the **Decorator pattern**:
adding behaviour around an existing interface without
modifying the underlying implementation.

### 9. Limitations of our implementation

Our current cache is intentionally simple.

- **Exact-text matching:** `"management"` and `"Management"`
  are different keys.
- **No expiry:** Cached embeddings remain until removed
  or the cache is discarded.
- **No size limit:** The Map can continue growing.
- **No disk persistence:** Restarting the process loses it.
- **No model awareness:** We must use a fresh cache when
  switching to a different embedding model.
- **Concurrent requests:** Two simultaneous requests for
  the same uncached text may both call the underlying provider.

The concurrency issue could be solved by caching the
pending Promise instead of only the completed embedding.

### Key takeaways

1. A `Map` stores key-value pairs and supports efficient lookups.
2. A cache avoids repeating expensive operations.
3. A closure allows our `embed()` method to retain access
   to the same Map between calls.
4. The Map persists in memory, not automatically on disk.
5. Each cached provider instance has its own Map.
6. Precomputation and caching are different techniques,
   but both help avoid unnecessary AI API calls.
7. Wrapping an interface lets us introduce caching without
   changing the code that uses the provider.


Prompt injection and trust boundaries: Retrieved data can contain instructions that attempt to manipulate an LLM. Use higher-priority system instructions to establish intended behaviour, and pass retrieved content as tool data rather than application instructions. These measures reduce risk but do not guarantee protection; important security properties should also be enforced in application code.

PII and data minimisation: AI applications should avoid sending unnecessary personal data to external models. A redaction layer can remove recognisable identifiers before data leaves the application. Pattern-based redaction is useful but incomplete; names, sensitive context and indirect identifiers require additional safeguards. Test redaction separately and apply it consistently at external-data boundaries.

Privacy at external boundaries: Redaction should happen before sensitive information leaves the application. Keeping privacy transformations separate from business logic allows semantic search to operate normally while controlling what is shared with an external LLM. A boundary must validate unexpected inputs rather than silently passing them through. Pattern-based redaction is only a partial safeguard and should not be confused with complete anonymisation.

Integration testing external API boundaries: Unit tests verify individual functions, while integration tests verify that components work together. By mocking fetch and inspecting the outgoing request body, we can confirm that privacy transformations happen before data is sent to an LLM. These tests are deterministic, free and do not require real API calls.

Structured outputs and grounding: Structured LLM responses make application-level verification possible. Zod checks the shape of an answer, while deterministic evidence checks verify that quoted passages exist in retrieved records. Both are necessary but neither guarantees that a free-text summary is accurate. For stronger grounding, answers need explicit evidence requirements and validation before being returned.

Agent-level grounding: Validation should happen at the application boundary before returning LLM-generated content. The agent collects evidence from trusted tool executions, sanitises it before external transmission, and verifies the final answer against that evidence. Structured outputs enable deterministic checks, but quotation verification alone does not establish that every summary or conclusion is correct.

TypeScript function overloads: Overloads let one function expose different return types based on its arguments. They are useful when an API supports multiple modes, such as plain-text and structured LLM responses. The implementation can be shared while callers receive precise TypeScript types.

Integration testing AI workflows: Unit tests verify individual functions, while integration tests verify how components work together. By mocking HTTP requests, we can test the real provider, tool execution, privacy redaction and grounding verification without making live LLM calls. This gives us repeatable tests for behaviour that would otherwise be unpredictable.

Evidence-aware AI agents: A model requesting a tool doesn't automatically make its answer trustworthy. The application should enforce which evidence must be retrieved, validate the model's response structure and independently verify quotations. Evidence requirements are application-controlled rather than left entirely to the model.

Claim-level grounding: Instead of validating only an LLM's final answer or quotations, we can require individual factual claims to reference evidence. Zod ensures that every claim has the expected structure and at least one source reference. Application-level verification must then confirm those references exist. This improves traceability but does not by itself prove semantic accuracy.

Source-reference verification: LLM-generated source IDs must be checked against evidence actually retrieved by the application. A discriminated union such as { valid: true } | { valid: false; reason: string } makes verification results explicit and easy to handle. Source existence establishes traceability, but semantic correctness requires additional verification.

Layered answer validation: Model-generated responses should pass through multiple checks before being accepted. Zod validates their structure, quotation verification checks exact text, and claim verification checks source references. Each layer addresses a different failure mode, but none alone guarantees that a model's interpretation is correct.

Deterministic numerical verification: Numerical claims should be represented as structured data and compared against validated tool results. This catches invented values without additional LLM calls. However, verifying structured numbers is different from verifying natural-language descriptions of those numbers.

Structured numerical grounding: Separating numerical data from model-generated display text allows application code to verify exact values against trusted tool results. However, free-text summaries can still contain unsupported numbers, so the final presentation layer must avoid treating unverified prose as verified.

Tool-result provenance: Verification should use data captured directly from application-executed tools, never values supplied by the LLM itself. Retaining validated tool results allows the application to check numerical claims deterministically. Evidence availability and evidence correctness are separate concerns.