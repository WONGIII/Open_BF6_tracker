export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import so poller only loads in Node runtime, not Edge
    import("@/lib/poller").then(({ startBackgroundPoller }) => {
      const intervalSec = parseInt(process.env.BF6_POLL_INTERVAL_SECONDS || "300", 10);
      startBackgroundPoller(intervalSec);
    });
  }
}
