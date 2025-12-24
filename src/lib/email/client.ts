import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

// Singleton instance
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const EMAIL_FROM = process.env.EMAIL_FROM || 'Execute <onboarding@resend.dev>';
