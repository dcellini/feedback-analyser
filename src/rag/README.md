# RAG — Retrieval-Augmented Generation

**Chapter 4 — Answering questions using employee feedback**

## 1. What does this folder do?

This folder allows us to ask questions about a collection of employee feedback.

For example:

**Question:** "What are employees saying about management?"

Instead of asking Gemini to answer from its general knowledge, we first find relevant employee comments and provide them to Gemini.

This is called **RAG (Retrieval-Augmented Generation)**.

- **Retrieval:** Find relevant information.
- **Augmented:** Add that information to the AI's instructions.
- **Generation:** Ask the AI to produce an answer using that information.

## 2. Why do we need RAG?

Without RAG, Gemini doesn't automatically know what employees have said.

RAG allows us to give Gemini the information it needs to answer a specific question.

For example, imagine we have these comments:

- "My manager is very supportive."
- "Communication from senior management is poor."
- "The office parking needs improving."

When asked about management, our application searches for relevant comments and supplies them to Gemini.

Gemini can then produce an answer such as:

"Employees appreciate