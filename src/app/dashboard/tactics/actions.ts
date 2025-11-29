"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateTacticInstancesForWeek, getWeekStart } from "@/utils/planning";
import { embeddingService } from "@/lib/agent/embedding-service";

export async function createTactic(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = formData.get("title") as string;
  const goal_id = formData.get("goal_id") as string;
  const description = formData.get("description") as string;
  const weight = parseFloat(formData.get("weight") as string) || 1.0;
  const recurrence = (formData.get("recurrence") as string) || "weekly";

  // Default to Friday (5) for weekly recurrence if not specified
  // In a real app, we'd have a UI for selecting days
  const due_days = [5];

  if (!title || !goal_id) {
    throw new Error("Title and Goal are required");
  }

  // Get user's org
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    throw new Error("No organization found");
  }

  const { data: tactic, error } = await supabase
    .from("tactics")
    .insert({
      org_id: membership.org_id,
      goal_id,
      title,
      description,
      weight,
      recurrence,
      due_days,
      assignee_user_id: user.id, // Default to creator
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating tactic:", error);
    throw new Error("Failed to create tactic");
  }

  // Index the tactic for RAG
  try {
    await embeddingService.indexTactic(supabase, tactic, membership.org_id);
  } catch (err) {
    console.error("Failed to index tactic:", err);
  }

  // Generate instances for current week
  try {
    await generateTacticInstancesForWeek(
      supabase,
      tactic.id,
      getWeekStart(),
      membership.org_id
    );
  } catch (e) {
    console.error("Error generating instances:", e);
    // Don't fail the request if generation fails, just log it
  }

  revalidatePath("/dashboard/goals");
  redirect("/dashboard/goals");
}
