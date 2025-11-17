import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);
const isVerifyEmailPage = createRouteMatcher(["/verify-email"]); // Add this
const isProtectedRoute = createRouteMatcher(["/courses(.*)"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // Allow verify-email page for authenticated users
    if (isVerifyEmailPage(request)) {
      return; // Don't redirect, allow access
    }
    
    if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/courses");
    }
    if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
  },
  {
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
  }
);

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
