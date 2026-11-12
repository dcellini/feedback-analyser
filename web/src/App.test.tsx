import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { QuestionResult } from "./api/types";

/**
 * CHAPTER 9 — FRONTEND TESTS
 *
 * These test the UI the way a visitor uses it: find things by their
 * visible text or accessible role, click, and check what appears.
 * (Testing Library deliberately makes it awkward to test implementation
 * details such as component state.)
 *
 * The API is replaced with a fake `fetch`, so these tests need no server
 * and are completely deterministic, just like the backend's mock
 * providers. The real API is already covered by the backend tests.
 */

const feedback = [
  { id: "fb-001", text: "My manager listens to me." },
  { id: "fb-002", text: "Please contact me at [EMAIL REDACTED]." },
];

const examples = [
  {
    id: "managers",
    question: "What do employees say about their managers?",
    kind: "genuine",
    note: "A genuine example.",
  },
  {
    id: "invented-quote",
    question: "Do employees want remote working?",
    kind: "deliberately-faulty",
    note: "Deliberately faulty example: invents a quote.",
  },
];

const verified: QuestionResult = {
  outcome: "verified",
  answer: {
    status: "answered",
    summary: "Employees value managers who listen.",
    claims: [{ text: "Some managers listen.", sourceIds: ["fb-001"] }],
    quotations: [{ sourceId: "fb-001", quote: "listens to me" }],
    numericalClaims: [{ metric: "totalFeedback", operator: "eq", value: 2 }],
  },
  toolCalls: [{ name: "searchFeedback", args: { query: "managers" } }],
  example: examples[0] as QuestionResult["example"],
};

const rejected: QuestionResult = {
  outcome: "rejected",
  reason: "Quotation does not match source: fb-001",
  toolCalls: [],
  example: examples[1] as QuestionResult["example"],
};

/** Builds a fake Response, as fetch would return. */
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * A fake fetch that answers like our API. `questionResponse` lets each
 * test choose what POST /api/questions returns.
 */
const installFakeApi = (questionResponse: () => Response) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/feedback") return json(200, { feedback });
      if (url === "/api/questions/examples") return json(200, { examples });
      if (url === "/api/feedback/fb-001/analysis") {
        return json(200, {
          analysis: { sentiment: "positive", themes: ["management"], priority: "low", summary: "Feels heard." },
        });
      }
      if (url === "/api/questions" && init?.method === "POST") return questionResponse();
      return json(404, { error: { code: "NOT_FOUND", message: "Not found" } });
    }),
  );
};

describe("App", () => {
  beforeEach(() => installFakeApi(() => json(200, verified)));
  afterEach(() => vi.unstubAllGlobals());

  it("shows the demo notice, the feedback and the example questions", async () => {
    render(<App />);

    expect(screen.getByText(/All 24 comments are invented/)).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText(/Coming soon: answers from a real AI model/)).toBeInTheDocument();
    expect(await screen.findByText("My manager listens to me.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /about their managers/ })).toBeInTheDocument();
  });

  it("labels deliberately faulty examples", async () => {
    render(<App />);

    const faulty = await screen.findByRole("button", { name: /remote working/ });
    expect(within(faulty).getByText("Deliberately faulty")).toBeInTheDocument();
  });

  it("shows a verified answer with its sources, quotations and numbers", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /about their managers/ }));

    expect(await screen.findByText("Answer passed verification")).toBeInTheDocument();
    expect(screen.getByText("Employees value managers who listen.")).toBeInTheDocument();
    expect(screen.getByText("“listens to me”")).toBeInTheDocument();
    expect(screen.getByText(/Total feedback comments =/)).toBeInTheDocument();

    // Source links point at the comment in the list below.
    const sourceLinks = screen.getAllByRole("link", { name: "Source comment fb-001" });
    expect(sourceLinks[0]).toHaveAttribute("href", "#fb-001");

    // The selected question is marked for screen readers.
    expect(screen.getByRole("button", { name: /about their managers/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows a rejected answer with the validator's reason", async () => {
    installFakeApi(() => json(200, rejected));
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /remote working/ }));

    expect(await screen.findByText("Answer rejected by the validator")).toBeInTheDocument();
    expect(screen.getByText("Quotation does not match source: fb-001")).toBeInTheDocument();
  });

  it("shows the API's error message when a question fails", async () => {
    installFakeApi(() =>
      json(422, { error: { code: "QUESTION_NOT_AVAILABLE", message: "Only example questions work." } }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /about their managers/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only example questions work.");
  });

  it("shows a friendly message and a retry button when the server is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<App />);

    const alerts = await screen.findAllByRole("alert");
    expect(alerts[0]).toHaveTextContent("Couldn't reach the server");
    expect(screen.getAllByRole("button", { name: "Try again" }).length).toBeGreaterThan(0);
  });

  it("analyses a comment on demand", async () => {
    const user = userEvent.setup();
    render(<App />);

    const item = (await screen.findByText("My manager listens to me.")).closest("li")!;
    await user.click(within(item).getByRole("button", { name: "Analyse" }));

    expect(await within(item).findByText("Feels heard.")).toBeInTheDocument();
    expect(within(item).getByText("positive")).toBeInTheDocument();
  });
});
