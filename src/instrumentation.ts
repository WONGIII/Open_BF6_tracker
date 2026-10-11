export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 本地只做界面预览时用 BF6_DISABLE_POLLER=1 跳过后台轮询：
    // 轮询器会在启动后立刻跑一轮 better-sqlite3 原生查询，
    // 在某些 Node 版本上会触发 Statement 析构断言把整个进程打崩，本地预览没必要跑它。
    if (process.env.BF6_DISABLE_POLLER === "1") {
      console.log("[poller] 已通过 BF6_DISABLE_POLLER=1 禁用（本地预览模式）");
      return;
    }
    // Dynamic import so poller only loads in Node runtime, not Edge
    import("@/lib/poller").then(({ startBackgroundPoller }) => {
      const intervalSec = parseInt(process.env.BF6_POLL_INTERVAL_SECONDS || "300", 10);
      startBackgroundPoller(intervalSec);
    });
  }
}
