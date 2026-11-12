import type { SearchableFeedback } from "../../embeddings/semantic-search.js";

/**
 * CHAPTER 8 — SYNTHETIC DEMO DATASET
 *
 * WHAT IS THIS?
 *
 * The feedback comments that visitors to the public demo will explore.
 *
 * Every comment here is INVENTED. None of it comes from a real employee,
 * company or survey. That matters for three reasons:
 *
 * 1. Privacy — real feedback must never be published, even "anonymised".
 * 2. Gemini terms — on Gemini's free tier, Google may use prompts to
 *    improve its products, so we only ever send it made-up data.
 * 3. Honesty — the README and UI label this data as synthetic.
 *
 * WHY THESE COMMENTS?
 *
 * They're written to give the demo something interesting to find:
 *
 * - Several themes (workload, management, communication, recognition,
 *   facilities, pay, career, wellbeing) so search has to choose.
 * - A mix of positive, negative and mixed comments.
 * - fb-020 deliberately contains a fake email address and phone number
 *   so the demo can show redaction working. Both are reserved for
 *   fiction: example.com is reserved for documentation, and Ofcom
 *   reserves 07700 900xxx numbers for TV and drama.
 * - Nothing about the canteen or food, so the demo can show an
 *   "insufficient evidence" answer when asked about it.
 *
 * WHY A TYPESCRIPT FILE RATHER THAN JSON?
 *
 * `as const satisfies ...` gives us type checking with no extra
 * configuration (importing .json files needs tsconfig changes).
 * `satisfies` checks the shape without widening the literal types.
 */
export const demoFeedback = [
  {
    id: "fb-001",
    text: "My manager makes time for weekly one-to-ones and genuinely listens when I raise problems.",
  },
  {
    id: "fb-002",
    text: "I rarely see my manager, and when I do the conversation is always about deadlines rather than how I'm doing.",
  },
  {
    id: "fb-003",
    text: "My workload has doubled since the restructure and I regularly work late just to keep up.",
  },
  {
    id: "fb-004",
    text: "We keep taking on new projects without anyone removing old ones, so the team is stretched very thin.",
  },
  {
    id: "fb-005",
    text: "The constant pressure to hit deadlines is starting to affect my sleep and my health.",
  },
  {
    id: "fb-006",
    text: "Important decisions are announced in all-hands meetings with no chance to ask questions beforehand.",
  },
  {
    id: "fb-007",
    text: "I found out about the office move from a client before anyone in leadership told us.",
  },
  {
    id: "fb-008",
    text: "The monthly updates from the leadership team have become much clearer and more honest this year.",
  },
  {
    id: "fb-009",
    text: "Extra effort goes unnoticed here; the same people get praised regardless of who did the work.",
  },
  {
    id: "fb-010",
    text: "My team lead thanked me in front of everyone after the product launch, which meant a lot.",
  },
  {
    id: "fb-011",
    text: "The office is too noisy for focused work and there aren't enough meeting rooms.",
  },
  {
    id: "fb-012",
    text: "The new desks and monitors are a big improvement, but the air conditioning is unreliable.",
  },
  {
    id: "fb-013",
    text: "Salaries haven't kept up with the cost of living, and the pay review process isn't transparent.",
  },
  {
    id: "fb-014",
    text: "I'd stay longer if there were a clear link between my performance reviews and pay rises.",
  },
  {
    id: "fb-015",
    text: "There's no clear path to promotion in my department, so I'm starting to look elsewhere.",
  },
  {
    id: "fb-016",
    text: "The training budget has let me complete two certifications this year, and I've used them straight away.",
  },
  {
    id: "fb-017",
    text: "Flexible working hours have made it much easier to manage school pick-ups.",
  },
  {
    id: "fb-018",
    text: "The mental health support on offer is hard to find and nobody talks about it.",
  },
  {
    id: "fb-019",
    text: "I really enjoy working with my immediate team; we support each other when things get busy.",
  },
  {
    id: "fb-020",
    text: "Please contact me at sam.taylor@example.com or on 07700 900123 to discuss the problems with my manager.",
  },
  {
    id: "fb-021",
    text: "The projects are interesting, but communication between departments is poor and work often gets duplicated.",
  },
  {
    id: "fb-022",
    text: "Managers change priorities every week, which makes it hard to finish anything properly.",
  },
  {
    id: "fb-023",
    text: "Parking is limited, so I usually have to arrive very early to get a space.",
  },
  {
    id: "fb-024",
    text: "Bonuses feel random and nobody explains how they are decided.",
  },
] as const satisfies readonly SearchableFeedback[];

/**
 * The ID of any record in the demo dataset.
 *
 * Derived from the data, so TypeScript knows the exact set of IDs:
 *
 *   type DemoFeedbackId = "fb-001" | "fb-002" | ... | "fb-024"
 *
 * The recordings files use this type, so a typo such as "fb-0003"
 * is a compile error rather than a confusing runtime failure.
 */
export type DemoFeedbackId = (typeof demoFeedback)[number]["id"];
