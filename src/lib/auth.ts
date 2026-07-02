import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { ensureAuthTables } from "@/lib/auth-schema";
import type { CurrentUser, UserRole } from "@/types/auth";

export type { CurrentUser, UserRole } from "@/types/auth";

export const SESSION_COOKIE_NAME = "acs_session";
export const LEGACY_COOKIE_NAME = "acs_token";
export const SESSION_TTL_DAYS = 7;

const roles: UserRole[] = ["admin", "manager", "analyst", "viewer"];
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

type SessionRow = RowDataPacket & {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: number;
  expires_at: Date | string;
};

export class AuthError extends Error {
  status: number;

  constructor(message = "Non authentifie.", status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

function normalizeRole(value?: string | null): UserRole {
  if (value && roles.includes(value as UserRole)) return value as UserRole;
  return "viewer";
}

function mysqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookieHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  const cookiesList = cookieHeader.split(";");
  for (const cookie of cookiesList) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

async function readCookie(request: Request | NextRequest | undefined, name: string) {
  const nextRequest = request as
    | (NextRequest & { cookies?: { get?: (name: string) => { value?: string } | undefined } })
    | undefined;
  const requestCookie = nextRequest?.cookies?.get?.(name)?.value;
  if (requestCookie) return requestCookie;

  const headerCookie = request ? parseCookieHeader(request.headers.get("cookie"), name) : null;
  if (headerCookie) return headerCookie;
  if (request) return null;

  const cookieStore = await cookies();
  return cookieStore.get(name)?.value || null;
}

export function getClientIp(request?: Request | NextRequest) {
  const forwarded = request?.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;

  return (
    request?.headers.get("x-real-ip") ||
    request?.headers.get("cf-connecting-ip") ||
    null
  );
}

export function getUserAgent(request?: Request | NextRequest) {
  return request?.headers.get("user-agent") || null;
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSession(userId: number, request?: Request | NextRequest) {
  await ensureAuthTables();

  const token = randomBytes(32).toString("base64url");
  const sessionHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await getDb().execute(
    `
    INSERT INTO app_sessions
      (user_id, session_hash, expires_at, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
    `,
    [
      userId,
      sessionHash,
      mysqlDate(expiresAt),
      getClientIp(request),
      getUserAgent(request),
    ],
  );

  return { token, sessionHash, expiresAt };
}

export async function destroySession(request?: Request | NextRequest) {
  await ensureAuthTables();

  const token = await readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const sessionHash = hashSessionToken(token);
  const user = await getCurrentUser(request);

  await getDb().execute("DELETE FROM app_sessions WHERE session_hash = ?", [sessionHash]);
  return user;
}

export async function getCurrentUser(
  request?: Request | NextRequest,
): Promise<CurrentUser | null> {
  await ensureAuthTables();

  const token = await readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const sessionHash = hashSessionToken(token);
  const [rows] = await getDb().query<SessionRow[]>(
    `
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.role,
      u.is_active,
      s.expires_at
    FROM app_sessions s
    JOIN app_users u ON u.id = s.user_id
    WHERE s.session_hash = ?
    LIMIT 1
    `,
    [sessionHash],
  );

  const row = rows[0];
  if (!row) return null;

  const expiresAt = new Date(row.expires_at);
  const expired = Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date();
  const inactive = Number(row.is_active) !== 1;
  if (expired || inactive) {
    await getDb().execute("DELETE FROM app_sessions WHERE session_hash = ?", [sessionHash]);
    return null;
  }

  return {
    id: Number(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: normalizeRole(String(row.role)),
  };
}

export async function requireUser(request?: Request | NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) throw new AuthError("Authentification requise.", 401);
  return user;
}

export function hasRole(user: CurrentUser, allowedRoles: UserRole[]) {
  return user.role === "admin" || allowedRoles.includes(user.role);
}

export async function requireRole(
  allowedRoles: UserRole[],
  request?: Request | NextRequest,
) {
  const user = await requireUser(request);
  if (!hasRole(user, allowedRoles)) {
    throw new AuthError("Droits insuffisants.", 403);
  }
  return user;
}

export async function logLoginAttempt(input: {
  email?: string | null;
  success: boolean;
  errorMessage?: string | null;
  request?: Request | NextRequest;
}) {
  await ensureAuthTables();

  await getDb().execute(
    `
    INSERT INTO app_login_attempts
      (email, success, ip_address, user_agent, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
    `,
    [
      input.email ? input.email.toLowerCase() : null,
      input.success ? 1 : 0,
      getClientIp(input.request),
      getUserAgent(input.request),
      input.errorMessage || null,
    ],
  );
}

export function canCreateFollowups(role: UserRole) {
  return role === "admin" || role === "manager";
}

export function canViewRawPath(role: UserRole) {
  return role === "admin";
}

export async function getRequestUser(request: Request | NextRequest) {
  return requireUser(request);
}

export async function getAuthenticatedRequestUser(request: Request | NextRequest) {
  return requireUser(request);
}

export async function getOptionalRequestUser(request: Request | NextRequest) {
  return getCurrentUser(request);
}

export async function getConfiguredUser() {
  return requireUser();
}
