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

/** A t.me link that opens the bot; pressing Start there connects this account. */
export function linkTelegram(token: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(token, "/api/me/telegram", { method: "POST" });
}

export function unlinkTelegram(token: string): Promise<void> {
  return apiFetch<void>(token, "/api/me/telegram", { method: "DELETE" });
}
