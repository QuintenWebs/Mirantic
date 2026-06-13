export const authConfig = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN as string,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID as string,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
};

export function assertAuthConfig(): string | null {
  if (!authConfig.domain) return "VITE_AUTH0_DOMAIN is not set";
  if (!authConfig.clientId) return "VITE_AUTH0_CLIENT_ID is not set";
  if (!authConfig.audience) return "VITE_AUTH0_AUDIENCE is not set";
  return null;
}
