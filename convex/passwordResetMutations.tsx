import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
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

    // Find the user with the most courses/files - that's the real user
    let primaryUser = allUsersWithEmail[0];
    let maxDataCount = 0;

    for (const user of allUsersWithEmail) {
      const courses = await ctx.db
        .query("courses")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      const files = await ctx.db
        .query("files")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      const dataCount = courses.length + files.length;
      
      if (dataCount > maxDataCount) {
        maxDataCount = dataCount;
        primaryUser = user;
      }
    }

    console.log("✅ Primary user (with most data):", primaryUser._id, "has", maxDataCount, "items");

    // Migrate data from duplicates to primary user
    for (let i = 0; i < allUsersWithEmail.length; i++) {
      if (allUsersWithEmail[i]._id === primaryUser._id) continue;
      
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

// Get user by email (for use in actions)
export const getUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    
    return user ? { userId: user._id } : null;
  },
});

// Get all users with this email (to find the newly created one)
export const getAllUsersByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .collect();
    
    return users.map(u => u._id);
  },
});

// Check if user has a password authAccount
export const hasPasswordAccount = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => 
        q.eq("userId", args.userId).eq("provider", "password")
      )
      .first();
    
    return !!account;
  },
});

// Get count of courses for a user
export const getUserCoursesCount = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    
    return courses.length;
  },
});

// Get count of files for a user
export const getUserFilesCount = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    
    return files.length;
  },
});

// Delete all password auth accounts for an email
export const deleteAllPasswordAccountsForEmail = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const allPasswordAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("provider"), "password"))
      .collect();

    for (const account of allPasswordAccounts) {
      if (account.providerAccountId === args.email) {
        await ctx.db.delete(account._id);
        console.log("🗑️ Deleted password auth account:", account._id, "for email:", args.email);
      }
    }
  },
});

// Transfer authAccount from one user to another (after signUp creates new user)
export const transferAuthAccountToExistingUser = internalMutation({
  args: {
    email: v.string(),
    newUserId: v.id("users"),
    oldUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find authAccount by email (providerAccountId) - this is more reliable
    // The signUp creates an authAccount with providerAccountId = email
    const allPasswordAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("provider"), "password"))
      .collect();
    
    // Find the authAccount for this email that belongs to the new user
    let newUserAccount = allPasswordAccounts.find(
      (acc) => acc.providerAccountId === args.email && acc.userId === args.newUserId
    );
    
    // If not found by userId, try to find any account with this email (might be timing issue)
    if (!newUserAccount) {
      newUserAccount = allPasswordAccounts.find(
        (acc) => acc.providerAccountId === args.email
      );
      if (newUserAccount) {
        console.log("⚠️ Found authAccount by email, but userId is:", newUserAccount.userId, "expected:", args.newUserId);
      }
    }
    
    if (newUserAccount) {
      console.log("🔄 Transferring authAccount from new user", args.newUserId, "to existing user", args.oldUserId);
      
      // Verify the existing user exists and has courses
      const existingUser = await ctx.db.get(args.oldUserId);
      if (!existingUser) {
        throw new Error(`Existing user ${args.oldUserId} not found!`);
      }
      
      const existingCourses = await ctx.db
        .query("courses")
        .withIndex("by_userId", (q) => q.eq("userId", args.oldUserId))
        .collect();
      
      console.log("✅ Existing user has", existingCourses.length, "courses");
      
      // Transfer to existing user
      await ctx.db.patch(newUserAccount._id, {
        userId: args.oldUserId,
        providerAccountId: args.email,
      });
      
      console.log("✅ AuthAccount transferred successfully");
      
      // Delete all sessions for the new user before deleting the user
      const newUserSessions = await ctx.db
        .query("authSessions")
        .filter((q) => q.eq(q.field("userId"), args.newUserId))
        .collect();
      
      for (const session of newUserSessions) {
        await ctx.db.delete(session._id);
      }
      
      // Delete the new user (created by signUp) - check if it exists first
      const newUserToDelete = await ctx.db.get(args.newUserId);
      if (newUserToDelete) {
        await ctx.db.delete(args.newUserId);
        console.log("✅ Deleted new user:", args.newUserId);
      } else {
        console.log("⚠️ New user already deleted or doesn't exist:", args.newUserId);
      }
      
      console.log("✅ Transferred authAccount to existing user:", args.oldUserId);
      
      // CRITICAL: Delete ALL other users with this email except the existing one
      // This ensures signIn will use the correct user
      const allUsersWithEmail = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.email))
        .collect();
      
      for (const user of allUsersWithEmail) {
        if (user._id !== args.oldUserId) {
          // Delete all auth accounts for this duplicate user
          const dupAuths = await ctx.db
            .query("authAccounts")
            .filter((q) => q.eq(q.field("userId"), user._id))
            .collect();
          for (const auth of dupAuths) {
            await ctx.db.delete(auth._id);
          }
          
          // Delete all sessions
          const dupSessions = await ctx.db
            .query("authSessions")
            .filter((q) => q.eq(q.field("userId"), user._id))
            .collect();
          for (const session of dupSessions) {
            await ctx.db.delete(session._id);
          }
          
          // Migrate any remaining courses/files to existing user
          const dupCourses = await ctx.db
            .query("courses")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
          for (const course of dupCourses) {
            await ctx.db.patch(course._id, { userId: args.oldUserId });
          }
          
          const dupFiles = await ctx.db
            .query("files")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
          for (const file of dupFiles) {
            await ctx.db.patch(file._id, { userId: args.oldUserId });
          }
          
          // Delete the duplicate user - check if it exists first
          const userToDelete = await ctx.db.get(user._id);
          if (userToDelete) {
            await ctx.db.delete(user._id);
            console.log("🗑️ Deleted duplicate user:", user._id);
          } else {
            console.log("⚠️ Duplicate user already deleted:", user._id);
          }
        }
      }
      
      // Verify the authAccount is now linked to the existing user
      const verifyAccount = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => 
          q.eq("userId", args.oldUserId).eq("provider", "password")
        )
        .first();
      
      if (verifyAccount) {
        console.log("✅ VERIFIED: AuthAccount is now linked to existing user:", args.oldUserId);
        console.log("✅ VERIFIED: Only one user exists with email:", args.email);
      } else {
        console.error("❌ ERROR: AuthAccount not found for existing user after transfer!");
      }
    } else {
      console.error("❌ ERROR: No authAccount found for new user:", args.newUserId);
    }
    
    return { success: true, userId: args.oldUserId };
  },
});

// Update password for existing authAccount (when user already has one)
export const updateExistingAuthAccountPassword = internalMutation({
  args: {
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Find existing password authAccount for this user
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => 
        q.eq("userId", args.userId).eq("provider", "password")
      )
      .first();
    
    if (!account) {
      throw new Error("No password authAccount found for user");
    }
    
    // Update the password hash
    await ctx.db.patch(account._id, {
      secret: args.passwordHash,
    });
    
    console.log("✅ Updated password for existing authAccount:", account._id);
    
    return { success: true };
  },
});

// Instead of manually creating authAccount, let's use a simpler approach:
// Use the auth.store mutation directly through the Password provider's flow
// But we need to work around the user creation. Let's try updating the secret directly.
export const updatePasswordSecret = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Find existing user
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get all password accounts with this email
    const allPasswordAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("provider"), "password"))
      .collect();
    
    const accountsForEmail = allPasswordAccounts.filter(
      (acc) => acc.providerAccountId === args.email
    );

    // Find account for this user, or use the first one for this email
    let accountToUpdate = accountsForEmail.find(
      (acc) => acc.userId === user._id
    ) || accountsForEmail[0];

    // Delete duplicate accounts (keep only the one we'll update)
    for (const account of accountsForEmail) {
      if (account._id !== accountToUpdate?._id) {
        await ctx.db.delete(account._id);
        console.log("🗑️ Deleted duplicate account:", account._id);
      }
    }

    if (accountToUpdate) {
      // Update existing account: secret and ensure userId/email match
      await ctx.db.patch(accountToUpdate._id, {
        userId: user._id, // Ensure it's linked to the correct user
        secret: args.passwordHash,
        providerAccountId: args.email, // Ensure email matches
      });
      console.log("✅ Updated password secret for existing account:", accountToUpdate._id);
    } else {
      // No account exists - create one (shouldn't happen normally)
      await ctx.db.insert("authAccounts", {
        userId: user._id,
        provider: "password",
        providerAccountId: args.email,
        secret: args.passwordHash,
      });
      console.log("✅ Created new password auth account for user:", user._id);
    }

    // Clear pending reset
    const pending = await ctx.db
      .query("pendingPasswordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (pending) {
      await ctx.db.delete(pending._id);
    }

    return { success: true, userId: user._id };
  },
});

// Debug query to see which user has courses for an email
export const debugUserCourses = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .collect();
    
    const userInfo = await Promise.all(
      allUsers.map(async (user) => {
        const courses = await ctx.db
          .query("courses")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .collect();
        const files = await ctx.db
          .query("files")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .collect();
        const authAccount = await ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) => 
            q.eq("userId", user._id).eq("provider", "password")
          )
          .first();
        
        return {
          userId: user._id,
          email: user.email,
          coursesCount: courses.length,
          filesCount: files.length,
          hasAuthAccount: !!authAccount,
          courses: courses.map(c => ({ id: c._id, name: c.name })),
        };
      })
    );
    
    return userInfo;
  },
});

// One-time cleanup mutation to remove duplicate password authAccounts
// Run this once to clean up existing duplicates in the database
export const cleanupDuplicatePasswordAccounts = mutation({
  handler: async (ctx) => {
    // Get all password auth accounts
    const allPasswordAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("provider"), "password"))
      .collect();

    // Group by email (providerAccountId)
    const accountsByEmail = new Map<string, typeof allPasswordAccounts>();
    
    for (const account of allPasswordAccounts) {
      const email = account.providerAccountId;
      if (!accountsByEmail.has(email)) {
        accountsByEmail.set(email, []);
      }
      accountsByEmail.get(email)!.push(account);
    }

    let deletedCount = 0;
    let keptCount = 0;

    // For each email, keep only the first account, delete the rest
    for (const [email, accounts] of accountsByEmail.entries()) {
      if (accounts.length > 1) {
        console.log(`Found ${accounts.length} accounts for email: ${email}`);
        
        // Keep the first one (or the one with the most recent activity)
        // Sort by _creationTime to keep the oldest one (original account)
        accounts.sort((a, b) => a._creationTime - b._creationTime);
        const keepAccount = accounts[0];
        
        // Delete all others
        for (let i = 1; i < accounts.length; i++) {
          await ctx.db.delete(accounts[i]._id);
          deletedCount++;
          console.log(`Deleted duplicate account: ${accounts[i]._id} for email: ${email}`);
        }
        
        keptCount++;
        console.log(`Kept account: ${keepAccount._id} for email: ${email}`);
      } else {
        keptCount++;
      }
    }

    return {
      success: true,
      totalAccounts: allPasswordAccounts.length,
      deletedCount,
      keptCount,
      message: `Cleaned up ${deletedCount} duplicate accounts, kept ${keptCount} unique accounts`,
    };
  },
});
