/**
 * Determines whether a feedback priority should be treated as high priority.
 *
 * This keeps the priority rule in one place rather than repeating
 * `priority === "high"` throughout the application.
 *
 * The function accepts a string rather than `FeedbackAnalysis["priority"]`
 * because it is a small, general-purpose helper that can safely return
 * false for any other value.
 */
export function isHighPriority(priority: string): boolean {
  return priority === "high";
}
