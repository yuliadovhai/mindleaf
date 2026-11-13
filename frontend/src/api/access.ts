import { apiFetch } from "./client";
import type { Invite, InviteCreated, Relation, StudentLink } from "./types";

export function createInvite(
  token: string,
  studentId: string,
  relation: Relation
): Promise<InviteCreated> {
  return apiFetch<InviteCreated>(token, `/api/students/${studentId}/invites`, {
    method: "POST",
    body: JSON.stringify({ relation }),
  });
}

export function listInvites(token: string, studentId: string): Promise<Invite[]> {
  return apiFetch<Invite[]>(token, `/api/students/${studentId}/invites`);
}

export function revokeInvite(token: string, studentId: string, inviteId: string): Promise<void> {
  return apiFetch<void>(token, `/api/students/${studentId}/invites/${inviteId}`, {
    method: "DELETE",
  });
}

export function listLinks(token: string, studentId: string): Promise<StudentLink[]> {
  return apiFetch<StudentLink[]>(token, `/api/students/${studentId}/links`);
}

export function removeLink(token: string, studentId: string, linkId: string): Promise<void> {
  return apiFetch<void>(token, `/api/students/${studentId}/links/${linkId}`, {
    method: "DELETE",
  });
}
