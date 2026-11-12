import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../api/client";

/**
 * CHAPTER 9 — ONE HOOK FOR EVERY API CALL
 *
 * Every request in the UI has the same four states:
 *
 *   idle → loading → success
 *                  ↘ error
 *
 * Modelling that as a DISCRIMINATED UNION (the same idea as the backend's
 * QuestionResult) makes impossible states impossible: you can't have
 * `data` and `error` at the same time, or `data` while loading.
 *
 *   if (state.status === "success") state.data;   // ✅ only here
 *
 * CANCELLATION
 *
 * If a visitor clicks question A, then quickly question B, A's response
 * might arrive AFTER B's and overwrite it. That's a classic RACE
 * CONDITION. The fix: each new run aborts the previous request with an
 * AbortController, and an aborted run never updates the state.
 *
 * The same happens when the component unmounts, so a late response
 * never updates a component that no longer exists.
 *
 * (Libraries such as TanStack Query handle this and caching for you. For
 * five endpoints, a 40-line hook is easier to understand.)
 */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };

/**
 * `task` must be STABLE (defined outside the component, or wrapped in
 * useCallback), because `run` is recreated whenever `task` changes.
 */
export const useAsyncTask = <Args extends unknown[], T>(
  task: (signal: AbortSignal, ...args: Args) => Promise<T>,
) => {
  const [state, setState] = useState<AsyncState<T>>({ status: "idle" });

  // The controller for the request currently in flight, if any.
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      // Cancel whatever was running before: only the latest run counts.
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      setState({ status: "loading" });

      try {
        const data = await task(controller.signal, ...args);

        if (!controller.signal.aborted) {
          setState({ status: "success", data });
        }
      } catch (error) {
        // An aborted run was replaced or unmounted: stay silent.
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          error:
            error instanceof ApiError
              ? error
              : new ApiError("UNEXPECTED_ERROR", "Something went wrong. Please try again."),
        });
      }
    },
    [task],
  );

  // On unmount, cancel any request still in flight.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, run };
};
