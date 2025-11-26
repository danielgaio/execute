"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateInstanceStatus(instanceId: string, newStatus: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const completedAt = newStatus === "done" ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("tactic_instances")
    .update({
      status: newStatus,
      completed_at: completedAt,
    })
    .eq("id", instanceId);

  if (error) throw new Error("Failed to update status");

  revalidatePath("/dashboard/week");
  revalidatePath("/dashboard");
}
