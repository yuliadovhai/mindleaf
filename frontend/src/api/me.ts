import { apiFetch } from "./client";
import type { Me, Redeemed } from "./types";

export function getMe(token: string): Promise<Me> {
  return apiFetch<Me>(token, "/api/me");
}

export function updateMe(
  token: string,
  data: { name?: string; cancel_notice_hours?: number }
): Promise<Me> {
  return apiFetch<Me>(token, "/api/me", { method: "PATCH", body: JSON.stringify(data) });
}

export function becomeTutor(token: string): Promise<Me> {
  return apiFetch<Me>(token, "/api/me/role", {
    method: "POST",
    body: JSON.stringify({ role: "tutor" }),
  });
}

export function redeemInvite(token: string, code: string): Promise<Redeemed> {
  return apiFetch<Redeemed>(token, "/api/invites/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
