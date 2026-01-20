import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

/**
 * Referral code (keep your old behaviour)
 */
export function generateReferralCode(uid: string) {
  return uid.slice(0, 6).toUpperCase();
}

/**
 * Production-grade unique reference
 * Example: WITHDRAW-9f1c2a6e2b7f4a1ea9c3e4f6a8b9c0d1
 */
export function generateReference(prefix: string) {
  const id = uuidv4().replace(/-/g, "");
  return `${prefix}-${id}`;
}

