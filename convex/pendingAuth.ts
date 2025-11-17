import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const createPendingUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("An account with this email already exists");
    }

    // Check if there's a pending registration
    const existingPending = await ctx.db
      .query("pendingUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingPending) {
      await ctx.db.delete(existingPending._id);
    }

    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store pending user with hashed password
    await ctx.db.insert("pendingUsers", {
      email: args.email,
      passwordHash: args.password, // In production, this should already be hashed
      code,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    // Send verification email
    await ctx.scheduler.runAfter(0, api.sendEmail.sendVerificationEmail, {
      email: args.email,
      code: code,
    });

    console.log(`Verification code for ${args.email}: ${code}`);
    
    return { success: true, code }; // Remove 'code' in production
  },
});

export const verifyAndCreateAccount = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const pendingUser = await ctx.db
      .query("pendingUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("verified"), false))
      .first();

    if (!pendingUser) {
      throw new Error("No pending registration found for this email");
    }

    // Check if expired
    if (Date.now() > pendingUser.expiresAt) {
      throw new Error("Verification code has expired");
    }

    // Check attempts
    if (pendingUser.attempts >= 5) {
      throw new Error("Too many failed attempts. Please register again");
    }

    // Check if code matches
    if (pendingUser.code !== args.code) {
      await ctx.db.patch(pendingUser._id, {
        attempts: pendingUser.attempts + 1,
      });
      throw new Error("Invalid verification code");
    }

    // Mark as verified
    await ctx.db.patch(pendingUser._id, {
      verified: true,
    });

    return { success: true, email: args.email, password: pendingUser.passwordHash };
  },
});
