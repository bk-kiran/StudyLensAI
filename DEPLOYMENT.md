# StudyLens AI Deployment Guide

This guide will help you deploy your StudyLens AI application to production with Convex backend and Vercel frontend.

## Prerequisites

- Convex account (you already have one: `dev:cool-wolf-57`)
- Vercel account (already deployed at: https://study-lens-ai-coral.vercel.app)
- Resend account for email sending

## Step 1: Deploy Convex Backend to Production

### Option A: Deploy via CLI (Recommended)

1. **Deploy your Convex functions to production:**
   ```bash
   npx convex deploy --prod
   ```

   This will create a production deployment and give you a production URL like:
   `https://your-project-name.convex.cloud`

2. **Note your production Convex URL** - you'll need this for Vercel environment variables.

### Option B: Deploy via Convex Dashboard

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project: `studylens-ai`
3. Navigate to "Deployments" 
4. Click "Deploy to Production" or create a new production deployment

## Step 2: Set Environment Variables in Convex Dashboard

Your Convex backend needs access to environment variables. Set these in the Convex Dashboard:

1. Go to your Convex project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

   - `RESEND_API_KEY`: Your Resend API key (same as in `.env.local`)
   - `CONVEX_SITE_URL`: Your Vercel deployment URL: `https://study-lens-ai-coral.vercel.app`

## Step 3: Configure Environment Variables in Vercel

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Select your project: `study-lens-ai-coral` (or similar)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables for **Production**, **Preview**, and **Development**:

   ```
   NEXT_PUBLIC_CONVEX_URL=https://your-production-convex-url.convex.cloud
   CONVEX_SITE_URL=https://study-lens-ai-coral.vercel.app
   RESEND_API_KEY=re_2MgHwc32_J5Bd1V2V4jNduUiHo3dpoSZz
   NEXT_PUBLIC_BASE_URL=https://study-lens-ai-coral.vercel.app
   ```

   **Important Notes:**
   - Replace `your-production-convex-url` with your actual production Convex URL from Step 1
   - Make sure `NEXT_PUBLIC_CONVEX_URL` uses the **production** Convex URL, not the dev one
   - `CONVEX_SITE_URL` should match your Vercel deployment URL exactly
   - `NEXT_PUBLIC_BASE_URL` should also match your Vercel deployment URL

## Step 4: Redeploy Your Vercel Application

After setting environment variables:

1. Go to your Vercel project dashboard
2. Click on **Deployments**
3. Click the **⋯** menu on your latest deployment
4. Click **Redeploy**
5. Or push a new commit to trigger a new deployment

## Step 5: Verify Deployment

1. Visit your deployed app: https://study-lens-ai-coral.vercel.app/signin
2. Try to sign in or create an account
3. Check Vercel logs if there are any errors:
   - Go to **Deployments** → Click on a deployment → **Functions** tab
4. Check Convex logs:
   - Go to Convex Dashboard → **Logs**

## Troubleshooting

### Server Error on Login

**Common causes:**
1. **Missing or incorrect `NEXT_PUBLIC_CONVEX_URL`**: 
   - Make sure it's set in Vercel environment variables
   - Make sure it's the production URL, not dev
   - The URL should look like: `https://xxxxx.convex.cloud`

2. **Convex backend not deployed**:
   - Run `npx convex deploy --prod` to deploy
   - Check Convex dashboard to ensure deployment succeeded

3. **Missing environment variables in Convex**:
   - `RESEND_API_KEY` must be set in Convex dashboard
   - `CONVEX_SITE_URL` must be set in Convex dashboard

4. **Auth configuration issues**:
   - `CONVEX_SITE_URL` in Vercel must match your actual Vercel URL
   - Check `convex/auth.config.ts` - it uses `CONVEX_SITE_URL`

### Email Not Sending

- Verify `RESEND_API_KEY` is set in both:
  - Convex Dashboard (for backend)
  - Vercel (if needed, though it's mainly used in Convex)

### Database Not Working

- Ensure Convex is deployed to production
- Check that `NEXT_PUBLIC_CONVEX_URL` points to production deployment
- Verify Convex dashboard shows your production deployment is active

## Quick Deployment Commands

```bash
# Deploy Convex to production
npx convex deploy --prod

# Check Convex deployment status
npx convex deployments

# View Convex logs
npx convex logs
```

## Environment Variables Summary

### Required in Vercel:
- `NEXT_PUBLIC_CONVEX_URL` - Production Convex URL
- `CONVEX_SITE_URL` - Your Vercel app URL
- `NEXT_PUBLIC_BASE_URL` - Your Vercel app URL
- `RESEND_API_KEY` - Your Resend API key

### Required in Convex Dashboard:
- `RESEND_API_KEY` - Your Resend API key
- `CONVEX_SITE_URL` - Your Vercel app URL

## Next Steps

After deployment:
1. Test sign up flow
2. Test sign in flow
3. Test email verification
4. Test password reset
5. Test course creation and file uploads

If you encounter any issues, check:
- Vercel function logs
- Convex dashboard logs
- Browser console for client-side errors


