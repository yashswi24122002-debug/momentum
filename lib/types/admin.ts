export type UserRole = "admin" | "member";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  must_change_password: boolean;
  created_at: string;
};
