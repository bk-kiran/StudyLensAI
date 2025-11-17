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
    console.log("🔵 EMAIL ACTION TRIGGERED", args.email, args.code);
    
    try {
      const result = await resend.emails.send({
        from: 'StudyLensAI <noreply@kiranbk.com>', // Updated to your domain
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
      
      console.log("✅ RESEND RESPONSE:", result);
      console.log(`Verification email sent to ${args.email}`);
      return { success: true };
    } catch (error) {
      console.error("❌ SEND EMAIL ERROR:", error);
      throw new Error("Failed to send verification email");
    }
  },
});

// NEW: Password reset email
export const sendPasswordResetEmail = action({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("🔵 PASSWORD RESET EMAIL TRIGGERED", args.email, args.code);
    
    try {
      const result = await resend.emails.send({
        from: 'StudyLensAI <noreply@kiranbk.com>', // Updated to your domain
        to: args.email,
        subject: 'Reset your password - StudyLensAI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Your reset code is:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="font-size: 36px; letter-spacing: 8px; margin: 0;">${args.code}</h1>
            </div>
            <p>This code will expire in 15 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
          </div>
        `,
      });
      
      console.log("✅ PASSWORD RESET EMAIL SENT:", result);
      return { success: true };
    } catch (error) {
      console.error("❌ PASSWORD RESET EMAIL ERROR:", error);
      throw new Error("Failed to send password reset email");
    }
  },
});
