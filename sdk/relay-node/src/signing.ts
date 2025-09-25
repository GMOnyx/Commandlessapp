import crypto from "crypto";

export function hmacSign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function nowUnixMs(): number {
  return Date.now();
}

