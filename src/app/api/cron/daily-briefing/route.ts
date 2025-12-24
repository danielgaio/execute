import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { BriefingService } from "@/lib/briefing/service";
import { EmailService } from "@/lib/email/service";

// Initialize Supabase Admin Client (Service Role)
// We need this to iterate through all users/orgs regardless of RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Verify Cron Secret (if configured)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // 1. Get all active users
    // In a real app, we might filter by timezone or user preferences
    const { data: users, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, org_id"); // Assuming profiles has org_id or we join

    if (error) throw error;

    const results = [];

    for (const user of users || []) {
      if (!user.email || !user.org_id) continue;

      // 2. Generate Briefing
      // We use the admin client but scope the query by org_id inside the service
      const briefing = await BriefingService.getBriefing(
        supabaseAdmin,
        user.org_id
      );

      // 3. Send Email if there are items
      if (briefing.stats.todayCount > 0 || briefing.stats.overdueCount > 0) {
        const emailResult = await EmailService.sendDailyBriefing(
          user.email,
          user.full_name || "User",
          briefing
        );
        results.push({ email: user.email, success: emailResult.success });
      } else {
        results.push({ email: user.email, skipped: "No items" });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Daily Briefing Cron Failed:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
