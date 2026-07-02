export type UserRole = "admin" | "manager" | "analyst" | "viewer";

export type CurrentUser = {
  email: string;
  role: UserRole;
};
