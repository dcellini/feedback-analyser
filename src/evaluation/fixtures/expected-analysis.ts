export const expectedAnalysis = {
  "positive-manager": {
    sentiment: "positive",
    themes: ["management", "recognition"],
    priority: "low",
  },

  "negative-communication": {
    sentiment: "negative",
    themes: ["communication", "leadership"],
    priority: "medium",
  },

  "neutral-office": {
    sentiment: "neutral",
    themes: ["work environment", "facilities"],
    priority: "low",
  },

  "high-priority": {
    sentiment: "negative",
    themes: ["management", "employee retention"],
    priority: "high",
  },

  mixed: {
    sentiment: "negative",
    themes: ["team", "workload", "leadership communication"],
    priority: "medium",
  },
} as const;
