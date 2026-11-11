// ============================================================
// 原生 gRPC unary 客户端（Node http2 + 手工 protobuf）
//
// 不依赖 @grpc/grpc-js：DICE / EADP 的网关都是标准 gRPC over HTTP/2，
// 单发 unary + 无压缩就够用。请求/响应体都是裸 protobuf。
// ============================================================

import http2 from "node:http2";

export interface GrpcCallOptions {
  metadata?: Record<string, string>;
  timeoutMs?: number;
}

export class GrpcError extends Error {
  code: number;
  status: string;
  constructor(code: number, status: string, message: string) {
    super(`gRPC ${status} (${code}): ${message}`);
    this.name = "GrpcError";
    this.code = code;
    this.status = status;
  }
}

const STATUS_NAMES: Record<number, string> = {
  0: "OK",
  1: "CANCELLED",
  2: "UNKNOWN",
  3: "INVALID_ARGUMENT",
  4: "DEADLINE_EXCEEDED",
  5: "NOT_FOUND",
  6: "ALREADY_EXISTS",
  7: "PERMISSION_DENIED",
  8: "RESOURCE_EXHAUSTED",
  9: "FAILED_PRECONDITION",
  10: "ABORTED",
  11: "OUT_OF_RANGE",
  12: "UNIMPLEMENTED",
  13: "INTERNAL",
  14: "UNAVAILABLE",
  15: "DATA_LOSS",
  16: "UNAUTHENTICATED",
};

interface SessionEntry {
  session: http2.ClientHttp2Session;
  ready: Promise<void>;
}

const sessions = new Map<string, SessionEntry>();

function getSession(host: string): SessionEntry {
  const existing = sessions.get(host);
  if (existing && !existing.session.closed && !existing.session.destroyed) return existing;

  const session = http2.connect(`https://${host}`, {
    // 网关只接受 TLS + h2
    ALPNProtocols: ["h2"],
    settings: { enablePush: false },
  });
  const entry: SessionEntry = {
    session,
    ready: new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        try {
          session.destroy();
        } catch {
          /* ignore */
        }
        reject(new Error(`gRPC connect timeout: ${host}`));
      }, 15_000);
      timer.unref?.();

      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        clearTimeout(timer);
        session.off("connect", onConnect);
        session.off("error", onError);
      };
      session.once("connect", onConnect);
      session.once("error", onError);
    }),
  };

  session.on("error", () => {
    /* 连接错误由具体请求处理，这里只防止未捕获异常 */
  });
  session.on("goaway", () => {
    sessions.delete(host);
    try {
      session.close();
    } catch {
      /* ignore */
    }
  });
  session.on("close", () => {
    if (sessions.get(host) === entry) sessions.delete(host);
  });

  sessions.set(host, entry);
  return entry;
}

function frame(message: Buffer): Buffer {
  const header = Buffer.alloc(5);
  header[0] = 0; // 未压缩
  header.writeUInt32BE(message.length, 1);
  return Buffer.concat([header, message]);
}

interface ParsedGrpcResponse {
  body: Buffer;
  status: number;
  message: string;
}

async function callOnce(
  host: string,
  path: string,
  message: Buffer,
  opts: GrpcCallOptions
): Promise<ParsedGrpcResponse> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const entry = getSession(host);
  await entry.ready;

  const headers: http2.OutgoingHttpHeaders = {
    ":method": "POST",
    ":path": path,
    ":authority": host,
    "content-type": "application/grpc",
    "te": "trailers",
    "grpc-timeout": `${Math.max(1, Math.floor(timeoutMs / 1000))}S`,
    "user-agent": "grpc-node-http2/openbf6tracker",
    ...(opts.metadata ?? {}),
  };

  return new Promise<ParsedGrpcResponse>((resolve, reject) => {
    let stream: http2.ClientHttp2Stream;
    try {
      stream = entry.session.request(headers, { endStream: false });
    } catch (err) {
      reject(err);
      return;
    }

    const chunks: Buffer[] = [];
    let headersStatus: number | undefined;
    let headersMessage = "";
    let trailersStatus: number | undefined;
    let trailersMessage = "";
    let settled = false;

    const finish = (result: ParsedGrpcResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    };

    const timer = setTimeout(() => {
      try {
        stream.close(http2.constants.NGHTTP2_CANCEL);
      } catch {
        /* ignore */
      }
      fail(new Error(`gRPC timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();

    stream.on("response", (h) => {
      const s = h["grpc-status"];
      if (s !== undefined) headersStatus = Number(String(s));
      const m = h["grpc-message"];
      if (m !== undefined) headersMessage = String(m);
    });
    stream.on("trailers", (h) => {
      const s = h["grpc-status"];
      if (s !== undefined) trailersStatus = Number(String(s));
      const m = h["grpc-message"];
      if (m !== undefined) trailersMessage = String(m);
    });

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", (err) => fail(err));
    stream.on("aborted", () => fail(new Error("gRPC stream aborted")));

    stream.on("end", () => {
      const raw = Buffer.concat(chunks);
      if (raw.length < 5) {
        finish({ body: Buffer.alloc(0), status: trailersStatus ?? headersStatus ?? 0, message: "" });
        return;
      }
      const compressed = raw[0] & 1;
      const len = raw.readUInt32BE(1);
      if (compressed) {
        fail(new Error("gRPC: compressed responses are not supported"));
        return;
      }
      const body = raw.subarray(5, 5 + len);
      const status = trailersStatus ?? headersStatus ?? 0;
      const messageRaw = trailersMessage || headersMessage || "";
      let message = messageRaw;
      try {
        message = decodeURIComponent(messageRaw);
      } catch {
        /* 保留原文 */
      }
      finish({ body, status, message });
    });

    stream.end(frame(message));
  });
}

/**
 * 执行一次 unary gRPC 调用，返回未解析的 protobuf 响应体。
 */
export async function unaryGrpc(
  host: string,
  path: string,
  message: Buffer,
  opts: GrpcCallOptions = {}
): Promise<Buffer> {
  let result: ParsedGrpcResponse;
  try {
    result = await callOnce(host, path, message, opts);
  } catch (err) {
    // 会话失效（goaway / 连接被网关断开）时换一条连接重试一次
    const entry = sessions.get(host);
    if (entry) {
      sessions.delete(host);
      try {
        entry.session.destroy();
      } catch {
        /* ignore */
      }
    }
    result = await callOnce(host, path, message, opts);
  }

  if (result.status !== 0) {
    throw new GrpcError(
      result.status,
      STATUS_NAMES[result.status] || `CODE_${result.status}`,
      result.message || "(no message)"
    );
  }
  return result.body;
}

export function closeGrpcSessions(): void {
  for (const [, entry] of sessions) {
    try {
      entry.session.destroy();
    } catch {
      /* ignore */
    }
  }
  sessions.clear();
}
