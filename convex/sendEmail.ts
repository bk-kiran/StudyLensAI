"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = action({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await resend.emails.send({
        from: 'StudyLensAI <onboarding@resend.dev>', // Use test domain
        to: args.email,
        subject: 'Verify your email - StudyLensAI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to StudyLensAI!</h2>
            <p>Your verification code is:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="font-size: 36px; letter-spacing: 8px; margin: 0;">${args.code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });
      
      console.log(`Verification email sent to ${args.email}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error("Failed to send verification email");
    }
  },
});
