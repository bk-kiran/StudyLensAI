"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const sendVerificationEmail = action({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Use Resend, SendGrid, or any email service
    // Example with Resend (you'll need to install it and add API key to env)
    
    /*
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'StudyLensAI <noreply@yourdomain.com>',
      to: args.email,
      subject: 'Verify your email - StudyLensAI',
      html: `
        <h2>Welcome to StudyLensAI!</h2>
        <p>Your verification code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px;">${args.code}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `,
    });
    */

    // For development, just log it
    console.log(`Send verification code ${args.code} to ${args.email}`);
    
    return { success: true };
  },
});
