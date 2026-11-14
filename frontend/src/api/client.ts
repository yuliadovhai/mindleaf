const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: unknown
  ) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.name = "ApiError";
  }
}

/** 402 = the tutor's plan does not allow it: show a sentence, not a code. */
export const PLAN_MESSAGES: Record<string, string> = {
  plan_read_only:
    "Кабінет лише для перегляду: Pro закінчився, а учнів більше, ніж дозволяє безкоштовний тариф. Оформіть Pro або заархівуйте зайвих учнів.",
  plan_limit: "На безкоштовному тарифі — до 3 активних учнів. Оформіть Pro, щоб додати більше.",
  pro_required: "Це доступно в тарифі Pro.",
};

let _signinRedirect: (() => Promise<void>) | null = null;

/** Реєструє функцію повторного входу; викликається з App при ініціалізації auth. */
export function setSigninRedirect(fn: () => Promise<void>): void {
  _signinRedirect = fn;
}

export async function apiFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      detail = body.detail ?? detail;
    } catch {
      // ignore parse error
    }
    if (res.status === 401 && _signinRedirect) {
      void _signinRedirect();
    }
    if (res.status === 402 && typeof detail === "string" && PLAN_MESSAGES[detail]) {
      detail = PLAN_MESSAGES[detail];
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}
