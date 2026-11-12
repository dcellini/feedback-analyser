import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import type { SearchableFeedback } from "../api/types";
import { useAsyncTask } from "../hooks/use-async-task";
import { AnswerView } from "./AnswerView";
import { ErrorMessage } from "./ErrorMessage";

/**
 * CHAPTER 9 — ASKING QUESTIONS
 *
 * Lists the example questions as buttons; clicking one sends it to
 * POST /api/questions and shows the result.
 *
 * WHY NO FREE-TEXT BOX?
 *
 * In replay mode the backend can only answer its recorded questions. A
 * text box that rejects almost everything would be frustrating, and would
 * suggest the demo can do more than it does. A live, rate-limited mode
 * can add one later.
 */

/*
 * Tasks are defined OUTSIDE the component, so they're the same function
 * on every render. useAsyncTask relies on that (see its comments).
 */
const loadExamples = (signal: AbortSignal) => api.listExampleQuestions(signal);
const ask = (signal: AbortSignal, question: string) => api.askQuestion(question, signal);

interface QuestionPanelProps {
  feedbackById: ReadonlyMap<string, SearchableFeedback>;
}

export const QuestionPanel = ({ feedbackById }: QuestionPanelProps) => {
  const examples = useAsyncTask(loadExamples);
  const answer = useAsyncTask(ask);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  const { run: runLoadExamples } = examples;

  useEffect(() => {
    void runLoadExamples();
  }, [runLoadExamples]);

  /*
   * On a phone, the answer appears below six question buttons, so it can
   * be off screen. Scroll it into view when it arrives. block: "nearest"
   * does nothing if it's already visible (as on most desktops).
   */
  useEffect(() => {
    if (answer.state.status === "success" || answer.state.status === "error") {
      answerRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [answer.state.status]);

  return (
    <section className="panel" aria-labelledby="questions-heading">
      <h2 id="questions-heading">Ask the agent a question</h2>
      <p className="panel__intro">
        The agent chooses which tools to call: semantic search over the comments, or a statistics
        tool for counts. Its answer is then checked: every claim needs a source, quotations must
        match word for word, and numbers must match the statistics tool.
      </p>

      {examples.state.status === "loading" && <p role="status">Loading example questions…</p>}

      {examples.state.status === "error" && (
        <ErrorMessage error={examples.state.error} onRetry={() => void examples.run()} />
      )}

      {examples.state.status === "success" && (
        <ul className="examples">
          {examples.state.data.examples.map((example) => (
            <li key={example.id}>
              <button
                type="button"
                className="example"
                // aria-pressed tells screen readers which question is selected.
                aria-pressed={selectedId === example.id}
                onClick={() => {
                  setSelectedId(example.id);
                  void answer.run(example.question);
                }}
              >
                {example.question}
                {example.kind === "deliberately-faulty" && (
                  <span className="badge badge--faulty">Deliberately faulty</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
       * aria-live="polite": when the answer appears, screen readers announce
       * it once the user is idle, without moving their focus.
       */}
      <div className="answer-region" aria-live="polite" ref={answerRef}>
        {answer.state.status === "loading" && <p role="status">Running the agent and verifying its answer…</p>}

        {answer.state.status === "error" && <ErrorMessage error={answer.state.error} />}

        {answer.state.status === "success" && (
          <AnswerView result={answer.state.data} feedbackById={feedbackById} />
        )}
      </div>
    </section>
  );
};
