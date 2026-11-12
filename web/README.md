# Web — React frontend

The portfolio demo's user interface: React + TypeScript, built with Vite, styled with plain CSS.

## Running it locally

You need two terminals, both started from the repository root.

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Then open http://localhost:5173. Vite forwards every `/api/...` request to the API on port 3000
(see `vite.config.ts`). The API currently runs on the native `node:http` learning server; the
Express API will replace it with identical endpoints.

First time only, install the frontend's dependencies:

```bash
npm --prefix web install
```

## Tests and build

```bash
npm run test:web
```

```bash
npm run build:web
```

The build produces static files in `web/dist/`. These will be uploaded to S3 and served by
CloudFront.

## Key files

| File | Responsibility |
|---|---|
| `src/api/client.ts` | The only code that knows URLs and HTTP; turns every failure into an `ApiError` |
| `src/api/types.ts` | Response types, imported (types only) from the backend |
| `src/hooks/use-async-task.ts` | Loading / success / error state, with cancellation of stale requests |
| `src/App.tsx` | Page layout; loads the feedback once for both sections |
| `src/components/QuestionPanel.tsx` | Example questions and the answer area |
| `src/components/AnswerView.tsx` | Verified, insufficient-evidence and rejected answers |
| `src/components/FeedbackList.tsx` | The comments, each with on-demand analysis |
| `src/App.test.tsx` | Interaction tests with a fake `fetch` |

## Why a separate `package.json`?

React and Vite are only needed in the browser. Keeping them out of the backend's dependencies
means they can never end up in the backend's deployment bundle (for example, a Lambda function).
