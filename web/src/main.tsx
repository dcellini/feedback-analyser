import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

/**
 * CHAPTER 9 — ENTRY POINT
 *
 * Mounts the React app into <div id="root"> in index.html.
 *
 * StrictMode (development only) deliberately mounts components twice to
 * expose effects that don't clean up after themselves. Our useAsyncTask
 * hook aborts requests on unmount, so the first, discarded mount never
 * updates the page.
 */
const root = document.getElementById("root");

if (!root) {
  throw new Error('Missing <div id="root"> in index.html');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
