import { cookies } from "next/headers";
import { db, type User } from "./supabase";

export const SESSION_COOKIE = "afa_addr";

function adminAddresses(): string[] {
  return (process.env.ADMIN_ADDRESSES || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminAddress(address: string) {
  return adminAddresses().includes(address.toLowerCase());
}

/** Find or create a user by wallet address, promoting admins from env. */
export async function upsertUserByAddress(addressRaw: string): Promise<User> {
  const address = addressRaw.toLowerCase();
  const wantAdmin = isAdminAddress(address);

  const { data: existing, error } = await db
    .from("User")
    .select("*")
    .eq("walletAddress", address)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (existing) {
    if (wantAdmin && existing.role !== "ADMIN") {
      const { data: updated, error: upErr } = await db
        .from("User")
        .update({ role: "ADMIN" })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (upErr) throw new Error(upErr.message);
      return updated as User;
    }
    return existing as User;
  }

  const { data: created, error: insErr } = await db
    .from("User")
    .insert({ walletAddress: address, role: wantAdmin ? "ADMIN" : "USER" })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);
  return created as User;
}

/** Read the active session user from the cookie (null if not connected). */
export async function getSessionUser(): Promise<User | null> {
  const addr = cookies().get(SESSION_COOKIE)?.value;
  if (!addr) return null;
  return upsertUserByAddress(addr);
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
