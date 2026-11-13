import type { AuthProviderProps } from "react-oidc-context";

const authority = import.meta.env.VITE_COGNITO_AUTHORITY;
const client_id = import.meta.env.VITE_COGNITO_CLIENT_ID;
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;

export const oidcConfig: AuthProviderProps = {
  authority,
  client_id,
  redirect_uri: `${window.location.origin}/`,
  scope: "openid email profile",
  post_logout_redirect_uri: `${window.location.origin}/`,
  metadata: cognitoDomain
    ? {
        issuer: authority,
        authorization_endpoint: `${cognitoDomain}/oauth2/authorize`,
        token_endpoint: `${cognitoDomain}/oauth2/token`,
        end_session_endpoint: `${cognitoDomain}/logout`,
        jwks_uri: `${authority}/.well-known/jwks.json`,
        userinfo_endpoint: `${cognitoDomain}/oauth2/userInfo`,
      }
    : undefined,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};
