import { api } from "../api/client";
import type { FeedbackAnalysis, SearchableFeedback } from "../api/types";
import { useAsyncTask } from "../hooks/use-async-task";
import { ErrorMessage } from "./ErrorMessage";

/**
 * CHAPTER 9 — THE FEEDBACK LIST
 *
 * Shows every synthetic comment. Each one can be analysed on demand
 * (GET /api/feedback/:id/analysis).
 *
 * Each FeedbackItem has its OWN useAsyncTask, so analysing one comment
 * never affects another's loading or error state. That's per-component
 * state, the frontend equivalent of the backend's per-request state.
 */

const analyse = (signal: AbortSignal, id: string) => api.getFeedbackAnalysis(id, signal);

export const FeedbackList = ({ feedback }: { feedback: SearchableFeedback[] }) => (
  <ol className="feedback-list">
    {feedback.map((item) => (
      <FeedbackItem key={item.id} item={item} />
    ))}
  </ol>
);

const FeedbackItem = ({ item }: { item: SearchableFeedback }) => {
  const analysis = useAsyncTask(analyse);
  const isOpen = analysis.state.status !== "idle";

  return (
    // id={item.id} is the target of the source links in AnswerView (#fb-003).
    <li id={item.id} className="feedback-item" tabIndex={-1}>
      <span className="feedback-item__id">{item.id}</span>
      <p className="feedback-item__text">{item.text}</p>

      {!isOpen && (
        <button type="button" className="button-secondary" onClick={() => void analysis.run(item.id)}>
          Analyse
        </button>
      )}

      {analysis.state.status === "loading" && <p role="status">Analysing…</p>}

      {analysis.state.status === "error" && (
        <ErrorMessage error={analysis.state.error} onRetry={() => void analysis.run(item.id)} />
      )}

      {analysis.state.status === "success" && <AnalysisView analysis={analysis.state.data.analysis} />}
    </li>
  );
};

const AnalysisView = ({ analysis }: { analysis: FeedbackAnalysis }) => (
  <dl className="analysis">
    <div>
      <dt>Sentiment</dt>
      <dd>
        <span className={`badge badge--${analysis.sentiment}`}>{analysis.sentiment}</span>
      </dd>
    </div>
    <div>
      <dt>Priority</dt>
      <dd>
        <span className={`badge badge--priority-${analysis.priority}`}>{analysis.priority}</span>
      </dd>
    </div>
    <div className="analysis__wide">
      <dt>Themes</dt>
      <dd>
        <ul className="themes">
          {analysis.themes.map((theme) => (
            <li key={theme}>{theme}</li>
          ))}
        </ul>
      </dd>
    </div>
    <div className="analysis__wide">
      <dt>Summary</dt>
      <dd>{analysis.summary}</dd>
    </div>
  </dl>
);
