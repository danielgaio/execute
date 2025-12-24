import { createClient } from "@/utils/supabase/server";
import { generateWeeklyPlansForAllOrgs } from "@/lib/domain/planning";
import { EmailService } from "@/lib/email/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Ensure this runs dynamically

export async function GET(request: Request) {
  try {
    // Security check: Verify Authorization header (simple secret for cron)
    // In production, this should be a robust secret stored in env vars.
    // For now, we'll check for a 'CRON_SECRET' env var.
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if we have the env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn("Missing SUPABASE_SERVICE_ROLE_KEY, using standard client. RLS may block actions.");
    }

    // Create admin client
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const adminClient = (supabaseUrl && supabaseServiceKey) 
        ? createSupabaseClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })
        : await createClient(); // Fallback

    const result = await generateWeeklyPlansForAllOrgs(adminClient);

    // Send Notifications
    let emailsSent = 0;
    if (result.notifications && result.notifications.length > 0) {
      // Process in parallel but limit concurrency if needed (Resend handles high throughput well)
      await Promise.all(result.notifications.map(async (notif: any) => {
        if (notif.type === 'weekly_plan_ready') {
          const emailResult = await EmailService.sendWeeklyPlanReady(
            notif.email,
            notif.name,
            notif.cycleTitle,
            notif.weekStart,
            notif.itemCount
          );
          if (emailResult.success) emailsSent++;
        }
      }));
    }

    return NextResponse.json({
      success: true,
      generated: result.generated,
      emailsSent,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
