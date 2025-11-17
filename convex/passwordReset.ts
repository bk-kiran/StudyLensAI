"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

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
