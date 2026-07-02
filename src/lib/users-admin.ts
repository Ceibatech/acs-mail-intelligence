import { hash } from "bcryptjs";
import type { UserRole } from "@/types/auth";
import { createUser, getUserByEmail, listUsers } from "@/lib/users";

export async function ensureAdminUser() {
  const defaultAdmin = process.env.ADMIN_EMAIL || "admin@acs.ci";
  const defaultPassword = process.env.ADMIN_PASSWORD || "Admin123!";

  const existing = await getUserByEmail(defaultAdmin);
  if (!existing) {
    const passwordHash = await hash(defaultPassword, 10);
    await createUser(defaultAdmin, passwordHash, "admin");
  }
}

export async function getUsersForAdmin() {
  return listUsers();
}

export async function createAdminUser(email: string, password: string, role: UserRole) {
  const passwordHash = await hash(password, 10);
  return createUser(email, passwordHash, role);
}
