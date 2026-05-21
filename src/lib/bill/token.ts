import crypto from "crypto";

// 16 random bytes → 22 base64url chars → ~96 bits of entropy.
// Unguessable, comfortably collision-resistant for our scale.
export function generateReceiptToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}
