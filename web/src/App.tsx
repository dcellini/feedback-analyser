import { useEffect, useMemo } from "react";

import { api } from "./api/client";
import { ErrorMessage } from "./components/ErrorMessage";
import { FeedbackList } from "./components/FeedbackList";
import { QuestionPanel } from "./components/QuestionPanel";
import { useAsyncTask } from "./hooks/use-async-task";

/**
 * CHAPTER 9 — THE PAGE
 *
 * Layout:
 *
 *   Header        what this is, in a sentence, plus the GitHub link
 *   Demo notice   synthetic data, example responses (honesty first)
 *   Questions     the verified agent: the main feature
 *   Feedback      the 24 comments, each with on-demand analysis
 *   Footer        how it works
 *
 * The feedback list is loaded HERE, once, because two sections need it:
 * the list itself, and the answer view (to show the text of cited
 * comments). That's "lifting state up" to the nearest common parent.
 */

const GITHUB_URL = "https://github.com/dcellini/feedback-analyser";

const loadFeedback = (signal: AbortSignal) => api.listFeedback(signal);

export const App = () => {
  const feedback = useAsyncTask(loadFeedback);
  const { run: runLoadFeedback } = feedback;

  useEffect(() => {
    void runLoadFeedback();
  }, [runLoadFeedback]);

  /*
   * A Map from ID to comment, for quick lookup when showing sources.
   * useMemo rebuilds it only when the feedback data changes.
   */
  const feedbackById = useMemo(
    () =>
      new Map(
        feedback.state.status === "success"
          ? feedback.state.data.feedback.map((item) => [item.id, item])
          : [],
      ),
    [feedback.state],
  );

  return (
    <div className="page">
      <header className="header">
        <h1>Feedback Analyser</h1>
        <p className="header__tagline">
          An AI agent that answers questions about employee feedback, with every answer checked
          against its sources before you see it.
        </p>
        <a className="header__link" href={GITHUB_URL}>
          View the source on GitHub
        </a>
      </header>

      <aside className="notice" aria-label="About this demo">
        <strong>Demo mode.</strong> All 24 comments are invented. The AI responses are{" "}
        <em>example responses</em>, replayed through the real verification code: the tools,
        redaction, schema validation and grounding checks all run live. No AI service is called,
        so there's no cost per visit.
      </aside>

      <main>
        <QuestionPanel feedbackById={feedbackById} />

        <section className="panel" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading">The feedback</h2>
          <p className="panel__intro">
            Personal details are redacted before the AI sees any text, as in comment fb-020. Choose{" "}
            <em>Analyse</em> to see a comment's sentiment, themes and priority.
          </p>

          {feedback.state.status === "loading" && <p role="status">Loading feedback…</p>}

          {feedback.state.status === "error" && (
            <ErrorMessage error={feedback.state.error} onRetry={() => void feedback.run()} />
          )}

          {feedback.state.status === "success" && <FeedbackList feedback={feedback.state.data.feedback} />}
        </section>
      </main>

      <footer className="footer">
        <h2>How it works</h2>
        <ol>
          <li>The agent decides which tools to call: semantic search over embeddings, or a statistics tool.</li>
          <li>Tool results are redacted, then given back to the agent.</li>
          <li>The agent's final answer is validated with Zod, then grounded: sources must exist, quotations must match, and numbers must match the statistics tool.</li>
          <li>Answers that fail are rejected and shown as rejected, never passed off as correct.</li>
        </ol>
        <p>
          Built with TypeScript, Node.js, React, Zod and Gemini. <a href={GITHUB_URL}>Source and architecture on GitHub</a>.
        </p>
      </footer>
    </div>
  );
};
