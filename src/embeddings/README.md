# Embeddings — Finding Feedback by Meaning

**Chapter 3 — Embeddings and Semantic Search**

## 1. What does this folder do?

The `embeddings/` folder allows our application to search employee feedback based on **meaning**, rather than just matching exact words.

For example, searching for "good management" could find:

- "My manager is very supportive."
- "My team leader always helps me."

Even though the wording is different, the meaning is similar.

This is called **semantic search**.

## 2. What is an embedding?

An embedding is a list of numbers representing the meaning of text.

For example:

```text
"My manager is helpful"
          ↓
    Embedding model
          ↓
   [0.8, 0.2, 0.1]
```

These are simplified example numbers, not actual Gemini embeddings.

Text with similar meanings generally produces embeddings that are mathematically similar.

This allows us to compare text using numbers instead of relying only on matching keywords.

## 3. How does it work?

There are two main stages.

**Stage 1 — Prepare feedback**

```text
Employee comments
       ↓
prepareFeedback()
       ↓
Embedding provider
       ↓
Generate embeddings
       ↓
Feedback with embeddings
```

**Stage 2 — Search feedback**

```text
Question: "What about management?"
       ↓
semanticSearch()
       ↓
Generate question