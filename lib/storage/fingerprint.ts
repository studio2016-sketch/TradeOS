import { createHash } from "node:crypto";

export function fingerprintResearchFile(bytes: Uint8Array) {
  if (bytes.byteLength < 1 || bytes.byteLength > 25 * 1024 * 1024) throw new Error("File size outside supported intake range");
  return { sha256: createHash("sha256").update(bytes).digest("hex"), byteSize: bytes.byteLength };
}

export function researchObjectKey(owner: string, digest: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(owner) || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("Invalid artifact identity");
  return `owners/${owner}/sha256/${digest.slice(0,2)}/${digest}`;
}
