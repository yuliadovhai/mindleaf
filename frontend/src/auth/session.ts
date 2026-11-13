import { useAuth } from "react-oidc-context";

/** Local demo login (VITE_DEV_LOGIN=true): three buttons instead of Cognito.
 *  The backend accepts "Bearer dev:<sub>" only with DEV_AUTH=on (docker compose). */
export const DEV_LOGIN = import.meta.env.VITE_DEV_LOGIN === "true";

const DEV_KEY = "tutor-cabinet.dev-sub";

function readDevSub(): string | null {
  if (!DEV_LOGIN) return null;
  try {
    return sessionStorage.getItem(DEV_KEY);
  } catch {
    return null;
  }
}

export function devLogin(sub: string): void {
  sessionStorage.setItem(DEV_KEY, sub);
  window.location.assign("/");
}

export function devLogout(): void {
  sessionStorage.removeItem(DEV_KEY);
  window.location.assign("/");
}

export interface Session {
  token: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | undefined;
  isDev: boolean;
  signIn: () => void;
  signOut: () => void;
}

/** The one place that knows where the access token comes from. */
export function useSession(): Session {
  const auth = useAuth();
  const devSub = readDevSub();

  if (devSub) {
    return {
      token: `dev:${devSub}`,
      isLoading: false,
      isAuthenticated: true,
      error: undefined,
      isDev: true,
      signIn: devLogout,
      signOut: devLogout,
    };
  }

  return {
    token: auth.user?.access_token ?? "",
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error,
    isDev: false,
    signIn: () => void auth.signinRedirect(),
    signOut: () => {
      void auth.removeUser().then(() => {
        const domain = import.meta.env.VITE_COGNITO_DOMAIN;
        const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
        const logoutUri = encodeURIComponent(window.location.origin + "/");
        window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
      });
    },
  };
}
