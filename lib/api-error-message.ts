import axios from "axios";

// For delete toasts: show the server's plain-text message on a 409 (the item
// is still in use), otherwise the caller's existing fallback.
export function conflictMessage(error: unknown, fallback: string): string {
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 409 &&
    typeof error.response.data === "string" &&
    error.response.data.trim() !== ""
  ) {
    return error.response.data;
  }

  return fallback;
}
