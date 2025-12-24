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
      console.log(
        `[Mock Email] To: ${to} | Subject: Weekly Plan Ready | Items: ${itemCount}`
      );
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
   * Send a summary of the Weekly Progress Review.
   */
  static async sendWPRSummary(
    to: string,
    name: string,
    weekStart: string,
    score: number,
    lagStatus: string,
    notes: string
  ): Promise<EmailResult> {
    if (!resend) {
      console.log(
        `[Mock Email] To: ${to} | Subject: WPR Summary | Score: ${score}`
      );
      return { success: true };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `Weekly Review Summary: ${weekStart} (${score}%)`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Weekly Progress Review</h2>
            <p><strong>Week of:</strong> ${weekStart}</p>
            <p><strong>Execution Score:</strong> ${score}%</p>
            <p><strong>Goal Status:</strong> ${lagStatus}</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Notes & Decisions</h3>
              <p style="white-space: pre-wrap;">${notes}</p>
            </div>

            <div style="margin: 20px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
            </div>
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
   * Send an organization invitation email
   */
  static async sendInvitation(
    to: string,
    organizationName: string,
    inviterName: string,
    role: string,
    invitationToken: string
  ): Promise<EmailResult> {
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation/accept?token=${invitationToken}`;

    if (!resend) {
      console.log(
        `[Mock Email] To: ${to} | Subject: Invitation to ${organizationName} | Role: ${role}`
      );
      console.log(`Invitation URL: ${inviteUrl}`);
      return { success: true };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `You're invited to join ${organizationName} on Execute`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to collaborate!</h2>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Execute.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Your Role:</strong> ${
                role.charAt(0).toUpperCase() + role.slice(1)
              }</p>
              <p style="margin-bottom: 0; font-size: 14px; color: #666;">
                You'll be able to collaborate on 12-week execution plans, track tactics, and participate in Weekly Progress Reviews.
              </p>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${inviteUrl}" style="background-color: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">
                Accept Invitation
              </a>
            </div>

            <p style="color: #666; font-size: 13px; margin-top: 30px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px; text-align: center;">
              Execute - Agent-First Productivity<br />
              <a href="${inviteUrl}" style="color: #999;">Click here if the button doesn't work</a>
            </p>
          </div>
        `,
      });

      if (error) throw error;
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Failed to send invitation email:", error);
      return { success: false, error };
    }
  }

  /**
   * Send a daily briefing email.
   */
  static async sendDailyBriefing(
    to: string,
    name: string,
    briefing: any // Using 'any' for now to avoid circular dependency or complex type import, but ideally BriefingService.DailyBriefing
  ): Promise<EmailResult> {
    if (!resend) {
      console.log(
        `[Mock Email] To: ${to} | Subject: Daily Briefing | Overdue: ${briefing.stats.overdueCount}`
      );
      return { success: true };
    }

    try {
      const analysisSection = briefing.scoreAnalysis
        ? (() => {
            const { score, status, recoveryPath } = briefing.scoreAnalysis;
            const color =
              status === "excellent"
                ? "#2e7d32"
                : status === "good"
                ? "#1976d2"
                : status === "at-risk"
                ? "#ed6c02"
                : "#d32f2f";

            let recoveryHtml = "";
            if (
              (status === "at-risk" || status === "critical") &&
              recoveryPath.length > 0
            ) {
              recoveryHtml = `
                 <div style="margin-top: 10px; font-size: 13px; background-color: #fff8e1; padding: 10px; border-radius: 4px;">
                   <strong>💡 Recovery Path:</strong> Complete these to improve your score:
                   <ul style="margin: 5px 0; padding-left: 20px;">
                     ${recoveryPath
                       .map((i: any) => `<li>${i.title}</li>`)
                       .join("")}
                   </ul>
                 </div>
               `;
            }

            return `
              <div style="border: 1px solid #eee; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; color: #333; font-size: 16px;">Weekly Score</h3>
                <div style="font-size: 24px; font-weight: bold; color: ${color}; margin-bottom: 5px;">
                  ${score.toFixed(
                    0
                  )}% <span style="font-size: 14px; font-weight: normal; color: #666; vertical-align: middle;">(${status.toUpperCase()})</span>
                </div>
                ${recoveryHtml}
              </div>
            `;
          })()
        : "";

      const overdueSection =
        briefing.overdue.length > 0
          ? `<div style="background-color: #fff0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
             <h3 style="color: #d32f2f; margin-top: 0;">⚠️ Overdue (${
               briefing.overdue.length
             })</h3>
             <ul style="padding-left: 20px;">
               ${briefing.overdue
                 .map(
                   (i: any) =>
                     `<li><strong>${i.title}</strong> (Due: ${i.due_date})</li>`
                 )
                 .join("")}
             </ul>
           </div>`
          : "";

      const todaySection =
        briefing.today.length > 0
          ? `<div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
             <h3 style="color: #1976d2; margin-top: 0;">📅 Today's Focus (${
               briefing.today.length
             })</h3>
             <ul style="padding-left: 20px;">
               ${briefing.today
                 .map(
                   (i: any) =>
                     `<li><strong>${
                       i.title
                     }</strong> [${i.status.toUpperCase()}]</li>`
                 )
                 .join("")}
             </ul>
           </div>`
          : `<p>🎉 Nothing scheduled for today.</p>`;

      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `Daily Briefing: ${briefing.date}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Good Morning, ${name}</h2>
            <p>Here is your briefing for <strong>${briefing.date}</strong>.</p>
            
            ${analysisSection}
            ${overdueSection}
            ${todaySection}

            <div style="margin: 20px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open Dashboard</a>
            </div>
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
}
