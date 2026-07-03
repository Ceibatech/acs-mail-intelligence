export const PUBLIC_APP_ORIGIN = "https://dashboard.acs.ci";

export function publicAppUrl(path = "/") {
  const normalizedPath =
    path.startsWith("/") && !path.startsWith("//")
      ? path
      : `/${path.replace(/^\/+/, "")}`;
  return new URL(normalizedPath, PUBLIC_APP_ORIGIN).toString();
}
