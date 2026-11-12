import type { DemoFeedbackId } from "./demo-feedback.js";

/**
 * CHAPTER 8 — RECORDED FEEDBACK ANALYSES (placeholders until Milestone 3)
 *
 * WHAT IS THIS?
 *
 * For each demo comment, the JSON that the AI provider returned when
 * asked to analyse it (Chapter 1's feedbackAnalyser workflow).
 *
 * WHY ARE THEY STRINGS?
 *
 * Because that's what a real AIProvider returns:
 *
 *   analyzeFeedback(feedback: string): Promise<string>
 *
 * Storing the raw strings means replayed analyses go through exactly the
 * same pipeline as live ones:
 *
 *   recorded string → JSON.parse → Zod validation → FeedbackAnalysis
 *
 * So even recorded data is treated as untrusted until Zod has checked it.
 * If someone edits this file and breaks the format, the demo fails the
 * same way it would if Gemini had returned something malformed.
 *
 * WHY "PLACEHOLDERS"?
 *
 * These were written by hand to look like plausible Gemini output.
 * Milestone 3 replaces them with real responses recorded from Gemini.
 *
 * `JSON.stringify(...)` is only here to keep the file readable — it
 * turns each object into the string the provider would have returned.
 */
export const demoAnalyses: Record<DemoFeedbackId, string> = {
  "fb-001": JSON.stringify({
    sentiment: "positive",
    themes: ["management", "one-to-ones", "being listened to"],
    priority: "low",
    summary: "The employee values regular one-to-ones and a manager who listens.",
  }),
  "fb-002": JSON.stringify({
    sentiment: "negative",
    themes: ["management", "deadlines", "wellbeing"],
    priority: "medium",
    summary: "The employee feels their manager is absent and focuses only on deadlines.",
  }),
  "fb-003": JSON.stringify({
    sentiment: "negative",
    themes: ["workload", "restructure", "working hours"],
    priority: "high",
    summary: "The employee's workload has doubled and they regularly work late.",
  }),
  "fb-004": JSON.stringify({
    sentiment: "negative",
    themes: ["workload", "prioritisation", "capacity"],
    priority: "high",
    summary: "New projects are added without removing old ones, overstretching the team.",
  }),
  "fb-005": JSON.stringify({
    sentiment: "negative",
    themes: ["workload", "deadlines", "health"],
    priority: "high",
    summary: "Deadline pressure is affecting the employee's sleep and health.",
  }),
  "fb-006": JSON.stringify({
    sentiment: "negative",
    themes: ["communication", "leadership", "decision-making"],
    priority: "medium",
    summary: "Decisions are announced without giving employees a chance to ask questions.",
  }),
  "fb-007": JSON.stringify({
    sentiment: "negative",
    themes: ["communication", "leadership", "office move"],
    priority: "medium",
    summary: "The employee heard about the office move from a client before leadership.",
  }),
  "fb-008": JSON.stringify({
    sentiment: "positive",
    themes: ["communication", "leadership", "transparency"],
    priority: "low",
    summary: "Leadership updates have become clearer and more honest.",
  }),
  "fb-009": JSON.stringify({
    sentiment: "negative",
    themes: ["recognition", "fairness"],
    priority: "medium",
    summary: "The employee feels extra effort is unrecognised and praise is unfair.",
  }),
  "fb-010": JSON.stringify({
    sentiment: "positive",
    themes: ["recognition", "management"],
    priority: "low",
    summary: "Public thanks from a team lead after a launch was meaningful.",
  }),
  "fb-011": JSON.stringify({
    sentiment: "negative",
    themes: ["office environment", "noise", "meeting rooms"],
    priority: "medium",
    summary: "The office is too noisy and lacks meeting rooms.",
  }),
  "fb-012": JSON.stringify({
    sentiment: "neutral",
    themes: ["office environment", "equipment", "air conditioning"],
    priority: "low",
    summary: "New equipment is welcome, but the air conditioning is unreliable.",
  }),
  "fb-013": JSON.stringify({
    sentiment: "negative",
    themes: ["pay", "cost of living", "transparency"],
    priority: "high",
    summary: "Pay has fallen behind living costs and reviews lack transparency.",
  }),
  "fb-014": JSON.stringify({
    sentiment: "neutral",
    themes: ["pay", "performance reviews", "retention"],
    priority: "medium",
    summary: "The employee wants a clearer link between performance and pay.",
  }),
  "fb-015": JSON.stringify({
    sentiment: "negative",
    themes: ["career progression", "retention"],
    priority: "high",
    summary: "With no promotion path, the employee is considering leaving.",
  }),
  "fb-016": JSON.stringify({
    sentiment: "positive",
    themes: ["training", "career development"],
    priority: "low",
    summary: "The training budget has funded useful certifications.",
  }),
  "fb-017": JSON.stringify({
    sentiment: "positive",
    themes: ["flexible working", "work-life balance"],
    priority: "low",
    summary: "Flexible hours make childcare commitments easier to manage.",
  }),
  "fb-018": JSON.stringify({
    sentiment: "negative",
    themes: ["mental health", "wellbeing support"],
    priority: "medium",
    summary: "Mental health support is hard to find and rarely discussed.",
  }),
  "fb-019": JSON.stringify({
    sentiment: "positive",
    themes: ["teamwork", "support"],
    priority: "low",
    summary: "The employee enjoys a supportive immediate team.",
  }),
  "fb-020": JSON.stringify({
    sentiment: "negative",
    themes: ["management", "follow-up request"],
    priority: "medium",
    summary: "The employee wants to discuss problems with their manager and asked to be contacted.",
  }),
  "fb-021": JSON.stringify({
    sentiment: "neutral",
    themes: ["communication", "cross-team collaboration", "duplicated work"],
    priority: "medium",
    summary: "Projects are interesting, but poor cross-team communication duplicates work.",
  }),
  "fb-022": JSON.stringify({
    sentiment: "negative",
    themes: ["management", "changing priorities", "workload"],
    priority: "medium",
    summary: "Weekly priority changes make it hard to finish work.",
  }),
  "fb-023": JSON.stringify({
    sentiment: "negative",
    themes: ["parking", "facilities"],
    priority: "low",
    summary: "Limited parking forces the employee to arrive early.",
  }),
  "fb-024": JSON.stringify({
    sentiment: "negative",
    themes: ["bonuses", "pay", "transparency"],
    priority: "medium",
    summary: "Bonuses seem random and the criteria are not explained.",
  }),
};
