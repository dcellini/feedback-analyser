import type { AgentRecording } from "../providers/replay-tool-provider.js";

/**
 * CHAPTER 8 — RECORDED AGENT CONVERSATIONS (placeholders until Milestone 3)
 *
 * WHAT IS THIS?
 *
 * The example questions visitors can ask, each with the provider
 * responses to replay (see replay-tool-provider.ts for how replay works).
 *
 * These were written by hand in the format Gemini returns, based on the
 * real conversations from Chapter 7. Milestone 3 re-records the genuine
 * ones from real Gemini responses.
 *
 * WHAT DOES EACH ONE DEMONSTRATE?
 *
 * | id                     | Shows                                          |
 * |------------------------|------------------------------------------------|
 * | workload-and-count     | Two tools, quotes and a verified count         |
 * | manager-views          | Mixed views, redacted source (fb-020)          |
 * | leadership-comms       | Negative and positive evidence together        |
 * | canteen-food           | An honest "insufficient evidence" answer       |
 * | invented-quote         | FAULTY: validator rejects an invented quote    |
 * | wrong-count            | FAULTY: validator rejects an incorrect number  |
 *
 * HOW DO WE KNOW THESE STILL WORK?
 *
 * demo-recordings.test.ts replays every recording through the real
 * pipeline and checks the outcome. If the dataset or embeddings change
 * so that a quoted comment is no longer retrieved, that test fails.
 */
export const demoRecordings: readonly AgentRecording[] = [
  {
    id: "workload-and-count",
    question: "How many feedback comments are there, and what do employees say about workload?",
    evidenceRequirement: "both",
    kind: "genuine",
    note: "The agent calls two tools: one to count comments and one to search them.",
    responses: [
      {
        type: "tool_call",
        toolCall: { name: "getFeedbackStats", args: {} },
      },
      {
        type: "tool_call",
        toolCall: { name: "searchFeedback", args: { query: "workload", limit: 4 } },
      },
      {
        type: "answer",
        answer: {
          status: "answered",
          summary:
            "There are 24 feedback comments. Workload is a clear concern: employees describe a workload that has grown faster than the team, long hours and effects on their health.",
          claims: [
            {
              text: "Some employees say their workload has increased and they work late to keep up.",
              sourceIds: ["fb-003"],
            },
            {
              text: "New work is added without old work being removed, stretching the team.",
              sourceIds: ["fb-004", "fb-022"],
            },
            {
              text: "Deadline pressure is affecting some employees' health.",
              sourceIds: ["fb-005"],
            },
          ],
          quotations: [
            { sourceId: "fb-003", quote: "I regularly work late just to keep up." },
            { sourceId: "fb-005", quote: "starting to affect my sleep and my health" },
          ],
          numericalClaims: [{ metric: "totalFeedback", operator: "eq", value: 24 }],
        },
      },
    ],
  },
  {
    id: "manager-views",
    question: "What do employees say about their managers?",
    evidenceRequirement: "feedback",
    kind: "genuine",
    note: "One retrieved comment contains an email address and phone number; both are redacted before the AI sees them.",
    responses: [
      {
        type: "tool_call",
        toolCall: { name: "searchFeedback", args: { query: "manager support", limit: 4 } },
      },
      {
        type: "answer",
        answer: {
          status: "answered",
          summary:
            "Views on managers are mixed. Some employees value regular one-to-ones, while others describe absent managers and frequently changing priorities.",
          claims: [
            {
              text: "Some employees value managers who hold regular one-to-ones and listen.",
              sourceIds: ["fb-001"],
            },
            {
              text: "Others feel their manager is absent or focuses only on deadlines.",
              sourceIds: ["fb-002", "fb-020"],
            },
            {
              text: "Frequently changing priorities make it hard to finish work.",
              sourceIds: ["fb-022"],
            },
          ],
          quotations: [
            { sourceId: "fb-001", quote: "genuinely listens when I raise problems" },
            {
              sourceId: "fb-002",
              quote: "the conversation is always about deadlines rather than how I'm doing",
            },
          ],
          numericalClaims: [],
        },
      },
    ],
  },
  {
    id: "leadership-comms",
    question: "Are there any concerns about communication from leadership?",
    evidenceRequirement: "feedback",
    kind: "genuine",
    note: "The answer includes both the concerns and a positive comment, rather than only the negatives.",
    responses: [
      {
        type: "tool_call",
        toolCall: {
          name: "searchFeedback",
          args: { query: "communication from leadership", limit: 4 },
        },
      },
      {
        type: "answer",
        answer: {
          status: "answered",
          summary:
            "Yes. Employees say decisions are announced without consultation and that news sometimes reaches them late, although one comment says leadership updates have improved.",
          claims: [
            {
              text: "Decisions are announced without a chance to ask questions.",
              sourceIds: ["fb-006"],
            },
            {
              text: "Some employees hear important news late, or from outside the company.",
              sourceIds: ["fb-007"],
            },
            {
              text: "Communication between departments is described as poor.",
              sourceIds: ["fb-021"],
            },
            {
              text: "One employee says leadership updates have become clearer and more honest.",
              sourceIds: ["fb-008"],
            },
          ],
          quotations: [
            {
              sourceId: "fb-007",
              quote: "I found out about the office move from a client before anyone in leadership told us.",
            },
            { sourceId: "fb-008", quote: "much clearer and more honest this year" },
          ],
          numericalClaims: [],
        },
      },
    ],
  },
  {
    id: "canteen-food",
    question: "What do employees think about the canteen food?",
    evidenceRequirement: "feedback",
    kind: "genuine",
    note: "No comment mentions the canteen, so the agent says so instead of inventing an answer.",
    responses: [
      {
        type: "tool_call",
        toolCall: { name: "searchFeedback", args: { query: "canteen food", limit: 3 } },
      },
      {
        type: "answer",
        answer: {
          status: "insufficient_evidence",
          summary:
            "None of the retrieved feedback mentions the canteen or food, so this question can't be answered from the available comments.",
          claims: [],
          quotations: [],
          numericalClaims: [],
        },
      },
    ],
  },
  {
    id: "invented-quote",
    question: "Do employees want more flexible or remote working?",
    evidenceRequirement: "feedback",
    kind: "deliberately-faulty",
    note: "Deliberately faulty example: the recorded answer quotes something fb-017 never said. The validator rejects it.",
    responses: [
      {
        type: "tool_call",
        toolCall: {
          name: "searchFeedback",
          args: { query: "flexible and remote working", limit: 3 },
        },
      },
      {
        type: "answer",
        answer: {
          status: "answered",
          summary: "Employees appreciate flexible working and want more of it.",
          claims: [
            {
              text: "Flexible hours help employees manage commitments outside work.",
              sourceIds: ["fb-017"],
            },
          ],
          quotations: [
            // Invented: fb-017 talks about flexible hours, not working from home.
            { sourceId: "fb-017", quote: "I would like to work from home three days a week." },
          ],
          numericalClaims: [],
        },
      },
    ],
  },
  {
    id: "wrong-count",
    question: "How many feedback comments have been submitted?",
    evidenceRequirement: "statistics",
    kind: "deliberately-faulty",
    note: "Deliberately faulty example: the recorded answer claims 30 comments, but the statistics tool returned 24. The validator rejects it.",
    responses: [
      {
        type: "tool_call",
        toolCall: { name: "getFeedbackStats", args: {} },
      },
      {
        type: "answer",
        answer: {
          status: "answered",
          summary: "There are 30 feedback comments.",
          claims: [],
          quotations: [],
          // Wrong: the tool reported totalFeedback = 24.
          numericalClaims: [{ metric: "totalFeedback", operator: "eq", value: 30 }],
        },
      },
    ],
  },
];
