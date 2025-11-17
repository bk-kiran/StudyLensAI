"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import bcrypt from "bcryptjs";
import { auth } from "./auth";

export const completePasswordReset = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; email: string }> => {
    // Store pending password reset (cleanup duplicates, delete old auth)
    await ctx.runMutation(internal.passwordResetMutations.storePendingPasswordReset, {
      email: args.email,
      code: args.code,
      newPassword: args.newPassword,
    });
    
    return {
      success: true,
      email: args.email,
    };
  },
});

// Hash password for password reset
export const hashPassword = action({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ passwordHash: string }> => {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(args.password, saltRounds);
    return { passwordHash };
  },
});

// Update password for existing user
// Instead of manually creating authAccount, we'll delete old ones and let
// the Password provider create it through signUp, then transfer to existing user
export const updatePasswordForExistingUser = action({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; userId: string; updatedExisting?: boolean }> => {
    // Find ALL users with this email to find the one with courses
    const allUsers = await ctx.runQuery(internal.passwordResetMutations.getAllUsersByEmail, {
      email: args.email,
    });
    
    if (allUsers.length === 0) {
      throw new Error("User not found");
    }
    
    // Find which user has the most courses/files
    let existingUserId = allUsers[0];
    let maxDataCount = 0;
    
    for (const userId of allUsers) {
      const courses = await ctx.runQuery(internal.passwordResetMutations.getUserCoursesCount, {
        userId: userId as any,
      });
      const files = await ctx.runQuery(internal.passwordResetMutations.getUserFilesCount, {
        userId: userId as any,
      });
      const dataCount = courses + files;
      
      if (dataCount > maxDataCount) {
        maxDataCount = dataCount;
        existingUserId = userId;
      }
    }
    
    console.log("✅ Using existing user with most data:", existingUserId, "has", maxDataCount, "items");
    
    // Check if existing user already has a password authAccount
    const hasAccount = await ctx.runQuery(internal.passwordResetMutations.hasPasswordAccount, {
      userId: existingUserId as any,
    });
    
    if (hasAccount) {
      // User already has an authAccount - we can update it directly
      // Hash the password and update the secret
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(args.newPassword, saltRounds);
      
      // Update the existing authAccount's password
      await ctx.runMutation(internal.passwordResetMutations.updateExistingAuthAccountPassword, {
        userId: existingUserId as any,
        passwordHash: passwordHash,
      });
      
      console.log("✅ Updated password for existing authAccount");
      return {
        success: true,
        userId: existingUserId,
        updatedExisting: true, // Flag to indicate we updated, not created
      };
    }
    
    // No existing authAccount - delete all password authAccounts for this email
    // This ensures we start fresh
    await ctx.runMutation(internal.passwordResetMutations.deleteAllPasswordAccountsForEmail, {
      email: args.email,
    });
    
    // Return success - the Password provider will create the authAccount
    // when the user signs in with signUp flow (we'll handle that in the frontend)
    return {
      success: true,
      userId: existingUserId, // Same userId = courses/files preserved
      updatedExisting: false,
    };
  },
});

// Transfer authAccount from newly created user (from signUp) to existing user
export const transferAuthAccountAfterSignUp = action({
  args: {
    email: v.string(),
    existingUserId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; userId: string }> => {
    // Find all users with this email - one should be the newly created one from signUp
    const allUsers = await ctx.runQuery(internal.passwordResetMutations.getAllUsersByEmail, {
      email: args.email,
    });
    
    // Find the new user (the one that's NOT the existing user)
    const newUser = allUsers.find(userId => userId !== args.existingUserId);
    
    if (!newUser) {
      // No new user found - maybe signUp didn't create one, or it's the same user
      // Check if there's an authAccount for the existing user
      const hasAccount = await ctx.runQuery(internal.passwordResetMutations.hasPasswordAccount, {
        userId: args.existingUserId as any,
      });
      
      if (hasAccount) {
        // Account already exists for existing user, no transfer needed
        return { success: true, userId: args.existingUserId };
      }
      
      throw new Error("No new user found after signUp");
    }
    
    // Transfer the authAccount and delete the new user
    const result = await ctx.runMutation(internal.passwordResetMutations.transferAuthAccountToExistingUser, {
      email: args.email,
      newUserId: newUser as any,
      oldUserId: args.existingUserId as any,
    });
    
    return result;
  },
});
