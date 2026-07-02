export type UserRole = "admin" | "manager" | "analyst" | "viewer";

export type CurrentUser = {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
};
