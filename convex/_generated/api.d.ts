/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as chatMessages from "../chatMessages.js";
import type * as courses from "../courses.js";
import type * as emailVerification from "../emailVerification.js";
import type * as examGenerator from "../examGenerator.js";
import type * as fileActions from "../fileActions.js";
import type * as files from "../files.js";
import type * as flashcards from "../flashcards.js";
import type * as http from "../http.js";
import type * as modalActions from "../modalActions.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetMutations from "../passwordResetMutations.js";
import type * as pendingAuth from "../pendingAuth.js";
import type * as sendEmail from "../sendEmail.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  chatMessages: typeof chatMessages;
  courses: typeof courses;
  emailVerification: typeof emailVerification;
  examGenerator: typeof examGenerator;
  fileActions: typeof fileActions;
  files: typeof files;
  flashcards: typeof flashcards;
  http: typeof http;
  modalActions: typeof modalActions;
  passwordReset: typeof passwordReset;
  passwordResetMutations: typeof passwordResetMutations;
  pendingAuth: typeof pendingAuth;
  sendEmail: typeof sendEmail;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
