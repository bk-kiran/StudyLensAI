// Temporary script to clean up duplicate password authAccounts
// Run with: node cleanup-duplicates.js

const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "YOUR_CONVEX_URL");

async function cleanup() {
  try {
    console.log("Starting cleanup of duplicate password authAccounts...");
    const result = await client.mutation("passwordResetMutations:cleanupDuplicatePasswordAccounts", {});
    console.log("✅ Cleanup complete:", result);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

cleanup();

