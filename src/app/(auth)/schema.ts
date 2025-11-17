import { z } from "zod";

export const signinSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().optional(), // Optional for sign-in
}).refine((data) => {
  // Only validate confirmPassword if it exists (sign-up mode)
  if (data.confirmPassword !== undefined) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // Show error on confirmPassword field
});

export type AuthFormValues = z.infer<typeof signinSchema>;
