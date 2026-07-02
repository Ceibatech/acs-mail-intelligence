import type { NextRequest } from "next/server";
import type { CurrentUser, UserRole } from "@/types/auth";
import { createHmac, timingSafeEqual } from "crypto";

const roles: UserRole[] = ["admin", "manager", "analyst", "viewer"];
const AUTH_SECRET = process.env.AUTH_SECRET || "default_acs_secret_2026";
const TOKEN_TTL_SECONDS = 60 * 60 * 24;

type AuthTokenPayload = {
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
};

function normalizeRole(value?: string | null): UserRole {
  if (value && roles.includes(value as UserRole)) return value as UserRole;
  return "viewer";
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createSignature(payload: string) {
  return base64url(createHmac("sha256", AUTH_SECRET).update(payload).digest());
}

function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const validSignature = createSignature(`${header}.${payload}`);
    const signatureBuffer = Buffer.from(signature, "utf8");
    const validBuffer = Buffer.from(validSignature, "utf8");

    if (signatureBuffer.length !== validBuffer.length) return null;
    if (!timingSafeEqual(signatureBuffer, validBuffer)) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (!decoded?.email || !decoded?.role || !decoded?.iat || !decoded?.exp) return null;
    if (Date.now() / 1000 > decoded.exp) return null;

    return {
      email: String(decoded.email),
      role: normalizeRole(String(decoded.role)),
      iat: Number(decoded.iat),
      exp: Number(decoded.exp),
    };
  } catch {
    return null;
  }
}

export function createAuthToken(payload: { email: string; role: UserRole }) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body: AuthTokenPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const payloadPart = base64url(JSON.stringify(body));
  const signature = createSignature(`${header}.${payloadPart}`);
  return `${header}.${payloadPart}.${signature}`;
}

export function getRequestUser(request: NextRequest): CurrentUser {
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const cookieToken = request.cookies.get("acs_token")?.value;
  const token = bearerToken || cookieToken;
  const payload = token ? verifyToken(token) : null;

  if (payload) {
    return { email: payload.email, role: payload.role };
  }

  return {
    email: process.env.APP_USER_EMAIL || "viewer@acs.ci",
    role: normalizeRole(process.env.APP_USER_ROLE),
  };
}

export function getAuthenticatedRequestUser(request: NextRequest): CurrentUser {
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const cookieToken = request.cookies.get("acs_token")?.value;
  const token = bearerToken || cookieToken;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    throw new Error("Unauthorized");
  }

  return { email: payload.email, role: payload.role };
}

export function getConfiguredUser(): CurrentUser {
  return {
    email: process.env.APP_USER_EMAIL || "viewer@acs.ci",
    role: normalizeRole(process.env.APP_USER_ROLE),
  };
}

export function canCreateFollowups(role: UserRole) {
  return role === "admin" || role === "manager";
}

export function canViewRawPath(role: UserRole) {
  return role === "admin";
}
