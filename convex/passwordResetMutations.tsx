import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";

function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("No account found with this email address");
    }

    const existingReset = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingReset) {
      await ctx.db.delete(existingReset._id);
    }

    const code = generateResetCode();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await ctx.db.insert("passwordResets", {
      email: args.email,
      code,
      expiresAt,
      verified: false,
      attempts: 0,
    });

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

    if (Date.now() > resetRequest.expiresAt) {
      await ctx.db.delete(resetRequest._id);
      throw new Error("Reset code has expired. Please request a new one.");
    }

    if (resetRequest.attempts >= 5) {
      await ctx.db.delete(resetRequest._id);
      throw new Error("Too many failed attempts. Please request a new reset code.");
    }

    if (resetRequest.code !== args.code) {
      await ctx.db.patch(resetRequest._id, {
        attempts: resetRequest.attempts + 1,
      });
      throw new Error("Invalid reset code");
    }

    await ctx.db.patch(resetRequest._id, {
      verified: true,
    });

    return { success: true };
  },
});

export const storePendingPasswordReset = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
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

    if (Date.now() > resetRequest.expiresAt) {
      await ctx.db.delete(resetRequest._id);
      throw new Error("Reset code has expired");
    }

    // Clean up duplicate users
    const allUsersWithEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .collect();

    console.log("🔍 Found users with this email:", allUsersWithEmail.length);

    // Keep only the first user
    const primaryUser = allUsersWithEmail[0];

    // Migrate data from duplicates to primary user
    for (let i = 1; i < allUsersWithEmail.length; i++) {
      const duplicateUser = allUsersWithEmail[i];
      
      // Migrate courses
      const dupCourses = await ctx.db
        .query("courses")
        .withIndex("by_userId", (q) => q.eq("userId", duplicateUser._id))
        .collect();
      
      for (const course of dupCourses) {
        await ctx.db.patch(course._id, { userId: primaryUser._id });
      }
      
      // Migrate files
      const dupFiles = await ctx.db
        .query("files")
        .withIndex("by_userId", (q) => q.eq("userId", duplicateUser._id))
        .collect();
      
      for (const file of dupFiles) {
        await ctx.db.patch(file._id, { userId: primaryUser._id });
      }
      
      // Delete duplicate's auth
      const dupAuths = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), duplicateUser._id))
        .collect();
      
      for (const auth of dupAuths) {
        await ctx.db.delete(auth._id);
      }
      
      // Delete duplicate's sessions
      const dupSessions = await ctx.db
        .query("authSessions")
        .filter((q) => q.eq(q.field("userId"), duplicateUser._id))
        .collect();
      
      for (const session of dupSessions) {
        await ctx.db.delete(session._id);
      }
      
      // Delete duplicate user
      await ctx.db.delete(duplicateUser._id);
      console.log("🗑️ Deleted duplicate user:", duplicateUser._id);
    }

    // Delete old password auth for primary user
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => 
        q.eq("userId", primaryUser._id).eq("provider", "password")
      )
      .collect();

    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    // Invalidate sessions
    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), primaryUser._id))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete old pending reset if exists
    const existingPending = await ctx.db
      .query("pendingPasswordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingPending) {
      await ctx.db.delete(existingPending._id);
    }

    // Store pending password reset
    await ctx.db.insert("pendingPasswordResets", {
      email: args.email,
      newPassword: args.newPassword,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Delete the reset request
    await ctx.db.delete(resetRequest._id);

    console.log("✅ Pending password reset stored for:", args.email);

    return { 
      success: true,
      email: args.email,
      userId: primaryUser._id,
    };
  },
});

// Check if there's a pending password reset and complete it
export const completePendingReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingPasswordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!pending) {
      return { hasPending: false };
    }

    if (Date.now() > pending.expiresAt) {
      await ctx.db.delete(pending._id);
      return { hasPending: false };
    }

    return {
      hasPending: true,
      newPassword: pending.newPassword,
    };
  },
});

// Clear pending reset after successful sign-up
export const clearPendingReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingPasswordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (pending) {
      await ctx.db.delete(pending._id);
    }
  },
});
