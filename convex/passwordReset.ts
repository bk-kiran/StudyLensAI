import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

// Generate a 6-digit reset code
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("No account found with this email address");
    }

    // Delete any existing reset requests for this email
    const existingReset = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingReset) {
      await ctx.db.delete(existingReset._id);
    }

    const code = generateResetCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store reset request
    await ctx.db.insert("passwordResets", {
      email: args.email,
      code,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    // Send reset email
    await ctx.scheduler.runAfter(0, api.sendEmail.sendPasswordResetEmail, {
      email: args.email,
      code: code,
    });

    console.log(`Password reset code for ${args.email}: ${code}`);

    return { success: true };
  },
});

export const verifyResetCode = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const resetRequest = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("verified"), false))
      .first();

    if (!resetRequest) {
      throw new Error("No password reset request found for this email");
    }

    // Check if expired
    if (Date.now() > resetRequest.expiresAt) {
      await ctx.db.delete(resetRequest._id);
      throw new Error("Reset code has expired. Please request a new one.");
    }

    // Check attempts
    if (resetRequest.attempts >= 5) {
      await ctx.db.delete(resetRequest._id);
      throw new Error("Too many failed attempts. Please request a new reset code.");
    }

    // Check if code matches
    if (resetRequest.code !== args.code) {
      await ctx.db.patch(resetRequest._id, {
        attempts: resetRequest.attempts + 1,
      });
      throw new Error("Invalid reset code");
    }

    // Mark as verified
    await ctx.db.patch(resetRequest._id, {
      verified: true,
    });

    return { success: true };
  },
});

export const completePasswordReset = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the reset request is still valid and verified
    const resetRequest = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("verified"), true))
      .first();

    if (!resetRequest) {
      throw new Error("Invalid or expired reset request");
    }

    if (resetRequest.code !== args.code) {
      throw new Error("Invalid reset code");
    }

    // Check if expired
    if (Date.now() > resetRequest.expiresAt) {
      await ctx.db.delete(resetRequest._id);
      throw new Error("Reset code has expired");
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get the password auth account
    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => 
        q.eq("userId", user._id).eq("provider", "password")
      )
      .first();

    if (authAccount) {
      // Delete the old password authentication
      await ctx.db.delete(authAccount._id);
    }

    // Delete the reset request
    await ctx.db.delete(resetRequest._id);

    // Return success - user can now set new password via sign-up flow
    return { 
      success: true,
      email: args.email,
    };
  },
});
