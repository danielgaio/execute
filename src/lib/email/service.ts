import { resend, EMAIL_FROM } from "./client";

interface EmailResult {
  success: boolean;
  error?: any;
  messageId?: string;
}

export class EmailService {
  /**
   * Send a notification that a weekly plan has been generated.
   */
  static async sendWeeklyPlanReady(
    to: string,
    name: string,
    cycleTitle: string,
    weekStart: string,
    itemCount: number
  ): Promise<EmailResult> {
    if (!resend) {
      console.log(`[Mock Email] To: ${to} | Subject: Weekly Plan Ready | Items: ${itemCount}`);
      return { success: true };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `Action Required: Your Weekly Plan for ${weekStart}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>Your weekly plan for <strong>${cycleTitle}</strong> (Week of ${weekStart}) has been automatically generated.</p>
            <p><strong>${itemCount} tactics</strong> have been scheduled for this week.</p>
            <div style="margin: 20px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Your Plan</a>
            </div>
            <p>Please review your plan and make any necessary adjustments to ensure a successful week.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">Execute - Agent-First Productivity</p>
          </div>
        `,
      });

      if (error) throw error;
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Failed to send email:", error);
      return { success: false, error };
    }
  }

  /**
   * Send a notification about low execution score.
   */
  static async sendLowScoreAlert(
    to: string,
    name: string,
    weekStart: string,
    score: number
  ): Promise<EmailResult> {
    if (!resend) {
      console.log(`[Mock Email] To: ${to} | Subject: Low Score Alert | Score: ${score}`);
      return { success: true };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `⚠️ At Risk: Execution Score ${score}%`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>Your execution score for the week of ${weekStart} was <strong>${score}%</strong>.</p>
            <p>This is below the recommended threshold of 85%. Consistent execution is key to achieving your goals.</p>
            <div style="margin: 20px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #d32f2f; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Analyze & Recover</a>
            </div>
            <p>Ask the Agent: <em>"Why was my score low last week?"</em> to get insights.</p>
          </div>
        `,
      });

      if (error) throw error;
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Failed to send email:", error);
      return { success: false, error };
    }
  }
}
