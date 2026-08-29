import { randomBytes } from "crypto";

// Readable-ish but strong enough for a one-time, immediately-rotated credential.
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "x");
}
