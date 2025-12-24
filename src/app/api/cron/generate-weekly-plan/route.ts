import { createClient } from "@/utils/supabase/server";
import { generateWeeklyPlansForAllOrgs } from "@/lib/domain/planning";
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

    const supabase = await createClient();
    
    // Note: createClient() in App Router usually uses cookies for auth.
    // For a cron job, we might need a service role client if it's running without a user session.
    // However, generateWeeklyPlansForAllOrgs iterates ALL orgs.
    // If we use the standard client, it might be restricted by RLS to the "logged in user" (which is none).
    // WE NEED A SERVICE ROLE CLIENT HERE to bypass RLS and process all orgs.
    // But `createClient` in `utils/supabase/server` is likely for the user session.
    
    // Let's check if we can create a service role client.
    // Usually this requires `SUPABASE_SERVICE_ROLE_KEY`.
    
    // If we don't have a service role client helper, we might need to instantiate one directly
    // using `createClient` from `@supabase/supabase-js`.
    
    // Let's assume for now we need to use the service role key.
    
    // Check if we have the env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        // Fallback to standard client if no service key (might fail RLS)
        // But for a "system" job, we really need admin access.
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

    return NextResponse.json({
      success: true,
      generated: result.generated,
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
