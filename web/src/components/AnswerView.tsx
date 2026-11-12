import type { GroundedAnswer, QuestionResult, SearchableFeedback, ToolCallSummary } from "../api/types";

/**
 * CHAPTER 9 — SHOWING A VERIFIED ANSWER (OR A REJECTION)
 *
 * The backend returns one of three things for a question, and each needs
 * a clearly different presentation:
 *
 *   outcome "verified" + status "answered"              → the answer + evidence
 *   outcome "verified" + status "insufficient_evidence" → an honest "can't say"
 *   outcome "rejected"                                  → what the validator caught
 *
 * Switching on those fields, rather than on loose booleans, means
 * TypeScript checks every case is handled and each branch only accesses
 * fields that exist.
 *
 * WHY SHOW THE EVIDENCE?
 *
 * The point of the project is that answers are GROUNDED: every claim cites
 * source comments, quotations match the source word for word, and numbers
 * come from a tool rather than the AI. Showing the sources and the
 * agent's steps lets a visitor check that for themselves.
 */

interface AnswerViewProps {
  result: QuestionResult;
  /** Used to show the text of each cited comment. */
  feedbackById: ReadonlyMap<string, SearchableFeedback>;
}

export const AnswerView = ({ result, feedbackById }: AnswerViewProps) => {
  if (result.outcome === "rejected") {
    return (
      <article className="answer answer--rejected" aria-labelledby="answer-heading">
        <h3 id="answer-heading" className="answer__heading">
          <span aria-hidden="true">✕</span> Answer rejected by the validator
        </h3>
        <p className="answer__reason">
          <strong>Reason:</strong> {result.reason}
        </p>
        <p className="answer__note">{result.example.note}</p>
        <AgentSteps toolCalls={result.toolCalls} />
      </article>
    );
  }

  const { answer } = result;

  if (answer.status === "insufficient_evidence") {
    return (
      <article className="answer answer--insufficient" aria-labelledby="answer-heading">
        <h3 id="answer-heading" className="answer__heading">
          <span aria-hidden="true">?</span> Not enough evidence to answer
        </h3>
        <p>{answer.summary}</p>
        <p className="answer__note">{result.example.note}</p>
        <AgentSteps toolCalls={result.toolCalls} />
      </article>
    );
  }

  return (
    <article className="answer answer--verified" aria-labelledby="answer-heading">
      <h3 id="answer-heading" className="answer__heading">
        <span aria-hidden="true">✓</span> Answer passed verification
      </h3>

      <p className="answer__summary">{answer.summary}</p>

      {answer.numericalClaims.length > 0 && <NumericalClaims claims={answer.numericalClaims} />}

      {answer.claims.length > 0 && (
        <section aria-labelledby="claims-heading">
          <h4 id="claims-heading">Claims and their sources</h4>
          <ul className="claims">
            {answer.claims.map((claim) => (
              <li key={claim.text}>
                {claim.text}{" "}
                <span className="sources">
                  {claim.sourceIds.map((id) => (
                    <SourceLink key={id} id={id} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.quotations.length > 0 && (
        <section aria-labelledby="quotes-heading">
          <h4 id="quotes-heading">Quotations (checked word for word)</h4>
          {answer.quotations.map((quotation) => (
            <figure key={`${quotation.sourceId}-${quotation.quote}`} className="quote">
              <blockquote>“{quotation.quote}”</blockquote>
              <figcaption>
                From <SourceLink id={quotation.sourceId} />
                {feedbackById.has(quotation.sourceId) && (
                  <span className="quote__full"> — full comment: “{feedbackById.get(quotation.sourceId)?.text}”</span>
                )}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      <p className="answer__note">{result.example.note}</p>
      <AgentSteps toolCalls={result.toolCalls} />
    </article>
  );
};

/**
 * A link to a comment in the feedback list below.
 *
 * href="#fb-003" scrolls to the element with id="fb-003", and the CSS
 * `:target` selector highlights it. That's navigation and highlighting
 * with no JavaScript, and it works with the keyboard and screen readers.
 */
const SourceLink = ({ id }: { id: string }) => (
  <a className="source-chip" href={`#${id}`} aria-label={`Source comment ${id}`}>
    {id}
  </a>
);

/** Plain-English labels for the structured numerical claims. */
const metricLabels: Record<string, string> = {
  totalFeedback: "Total feedback comments",
};

const operatorSymbols: Record<string, string> = {
  eq: "=",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

const NumericalClaims = ({ claims }: { claims: GroundedAnswer["numericalClaims"] }) => (
  <section aria-labelledby="numbers-heading">
    <h4 id="numbers-heading">Numbers (checked against the statistics tool)</h4>
    <ul className="numbers">
      {claims.map((claim) => (
        <li key={`${claim.metric}-${claim.operator}-${claim.value}`}>
          {metricLabels[claim.metric] ?? claim.metric} {operatorSymbols[claim.operator] ?? claim.operator}{" "}
          <strong>{claim.value}</strong> <span className="tick">✓ verified</span>
        </li>
      ))}
    </ul>
  </section>
);

/**
 * The tools the agent called, in order.
 *
 * <details> gives a collapsible section that works without JavaScript and
 * is keyboard accessible by default.
 */
const AgentSteps = ({ toolCalls }: { toolCalls: ToolCallSummary[] }) => (
  <details className="steps">
    <summary>Agent steps ({toolCalls.length} tool {toolCalls.length === 1 ? "call" : "calls"})</summary>
    <ol>
      {toolCalls.map((call, index) => (
        <li key={index}>
          <code>
            {call.name}({formatArgs(call.args)})
          </code>
        </li>
      ))}
    </ol>
  </details>
);

const formatArgs = (args: unknown): string =>
  args && typeof args === "object" && Object.keys(args).length > 0 ? JSON.stringify(args) : "";
