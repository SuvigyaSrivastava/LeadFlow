import { toast } from "sonner";

import { ApiError } from "@/lib/api";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.fields[0]?.message ?? error.message;
  return "Something went wrong. Please try again.";
}

export const notifyError = (title: string, error: unknown) =>
  toast.error(title, { description: errorMessage(error) });

export const notifySuccess = (title: string, description?: string) =>
  toast.success(title, { description });
