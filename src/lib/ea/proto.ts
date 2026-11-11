// ============================================================
// 极简 protobuf 编解码器（无第三方依赖）
// 只覆盖 BF6 gRPC 网关用到的类型：
//   varint(0) / fixed64(1) / bytes+string(2) / fixed32(5)
// 所有 int64 一律用 BigInt 处理，读出时在安全范围内转 number。
// ============================================================

export type PbField = {
  no: number;
  wire: number;
  /** varint 值（BigInt） */
  int?: bigint;
  /** length-delimited 原始字节 */
  bytes?: Buffer;
};

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function encVarint(value: number | bigint | string): Buffer {
  let v =
    typeof value === "bigint"
      ? value
      : typeof value === "string"
        ? BigInt(value)
        : BigInt(Math.trunc(value));
  if (v < 0n) {
    // protobuf int64 负数按 64 位补码编码
    v = (1n << 64n) + v;
  }
  const out: number[] = [];
  while (true) {
    const b = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) out.push(b | 0x80);
    else {
      out.push(b);
      break;
    }
  }
  return Buffer.from(out);
}

function tag(no: number, wire: number): Buffer {
  return encVarint((no << 3) | wire);
}

export function pbVarint(no: number, value: number | bigint | boolean | string): Buffer {
  return Buffer.concat([tag(no, 0), encVarint(typeof value === "boolean" ? (value ? 1 : 0) : value)]);
}

export function pbString(no: number, value: string): Buffer {
  return pbBytes(no, Buffer.from(value, "utf8"));
}

export function pbBytes(no: number, value: Buffer): Buffer {
  return Buffer.concat([tag(no, 2), encVarint(value.length), value]);
}

export function pbMsg(no: number, value: Buffer): Buffer {
  return pbBytes(no, value);
}

export function decode(buf: Buffer): PbField[] {
  const out: PbField[] = [];
  let i = 0;
  const readVarint = (): bigint => {
    let v = 0n;
    let shift = 0n;
    while (true) {
      if (i >= buf.length) throw new Error("protobuf: truncated varint");
      const b = buf[i++];
      v |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return v;
      shift += 7n;
      if (shift > 70n) throw new Error("protobuf: varint too long");
    }
  };

  while (i < buf.length) {
    const key = Number(readVarint());
    const no = key >>> 3;
    const wire = key & 7;
    if (no === 0) throw new Error("protobuf: field number 0");
    if (wire === 0) {
      out.push({ no, wire, int: readVarint() });
    } else if (wire === 2) {
      const len = Number(readVarint());
      if (i + len > buf.length) throw new Error("protobuf: truncated bytes");
      out.push({ no, wire, bytes: buf.subarray(i, i + len) });
      i += len;
    } else if (wire === 5) {
      out.push({ no, wire, bytes: buf.subarray(i, i + 4) });
      i += 4;
    } else if (wire === 1) {
      out.push({ no, wire, bytes: buf.subarray(i, i + 8) });
      i += 8;
    } else {
      throw new Error(`protobuf: unsupported wire type ${wire}`);
    }
  }
  return out;
}

export function fieldsOf(buf: Buffer, no: number): PbField[] {
  return decode(buf).filter((f) => f.no === no);
}

export function asMsg(f: PbField): Buffer {
  if (!f.bytes) throw new Error("protobuf: field is not a message");
  return f.bytes;
}

export function asString(f: PbField): string {
  return f.bytes ? f.bytes.toString("utf8") : "";
}

export function asInt(f: PbField): number {
  const v = f.int ?? 0n;
  return v <= MAX_SAFE ? Number(v) : Number(v & BigInt(0x1fffffffffffff));
}

export function asBigInt(f: PbField): bigint {
  return f.int ?? 0n;
}

/** 读取 Google StringValue 包装：f1 { f1 = "text" } */
export function unwrapStringValue(buf: Buffer): string {
  const outer = decode(buf);
  const inner = outer.find((f) => f.no === 1 && f.bytes);
  return inner ? asString(inner) : "";
}
