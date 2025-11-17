import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const createVerificationCode = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if there's an existing unverified code
    const existing = await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("verified"), false))
      .first();

    // Delete old unverified codes for this email
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await ctx.db.insert("emailVerifications", {
      email: args.email,
      code,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    // In production, send email here via an action
    // For now, return the code (REMOVE THIS IN PRODUCTION)
    console.log(`Verification code for ${args.email}: ${code}`);
    
    return { success: true, code }; // Remove 'code' in production
  },
});

export const verifyCode = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("verified"), false))
      .first();

    if (!verification) {
      throw new Error("No verification code found for this email");
    }

    // Check if expired
    if (Date.now() > verification.expiresAt) {
      throw new Error("Verification code has expired");
    }

    // Check attempts (max 5)
    if (verification.attempts >= 5) {
      throw new Error("Too many failed attempts. Please request a new code");
    }

    // Check if code matches
    if (verification.code !== args.code) {
      // Increment attempts
      await ctx.db.patch(verification._id, {
        attempts: verification.attempts + 1,
      });
      throw new Error("Invalid verification code");
    }

    // Mark as verified
    await ctx.db.patch(verification._id, {
      verified: true,
    });

    return { success: true };
  },
});

export const isEmailVerified = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("verified"), true))
      .first();

    return !!verification;
  },
});

export const resendVerificationCode = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check rate limiting - prevent spam
    const recentCodes = await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const recentCode = recentCodes.find(
      (code) => Date.now() - (code.expiresAt - 10 * 60 * 1000) < 60 * 1000
    );

    if (recentCode) {
      throw new Error("Please wait 1 minute before requesting a new code");
    }

    // Delete old unverified codes for this email
    const existing = await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("verified"), false))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Create new code (duplicated logic from createVerificationCode)
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await ctx.db.insert("emailVerifications", {
      email: args.email,
      code,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    console.log(`Resent verification code for ${args.email}: ${code}`);
    
    return { success: true, code }; // Remove 'code' in production
  },
});
