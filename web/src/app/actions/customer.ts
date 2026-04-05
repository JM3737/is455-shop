"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function selectCustomerAction(formData: FormData) {
  const raw = formData.get("customer_id");
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    redirect("/select-customer?error=invalid");
  }
  cookies().set("selected_customer_id", String(id), {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
  });
  redirect("/dashboard");
}
