export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function mapSupabaseError(error: {
  message?: string;
  code?: string;
  details?: string;
}): AppError {
  const message = error.message || "Something went wrong. Please try again.";
  return new AppError(message, error.code ?? "SUPABASE_ERROR");
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
