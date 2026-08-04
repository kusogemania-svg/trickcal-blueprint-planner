import { solveMinimumRuns } from "./core/optimizer.js";

self.addEventListener("message", (event) => {
  const { requestId, requests, stages, timeoutMs } = event.data;
  try {
    const result = solveMinimumRuns({ requests, stages, timeoutMs });
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({
      requestId,
      result: { status: "error", message: error instanceof Error ? error.message : String(error) },
    });
  }
});
