import type { BookStatus } from "@db";

/** Outer border on book review action bars — matches status badge colours. */
export function bookStatusBarBorderClass(status: BookStatus): string {
  switch (status) {
    case "draft":
      return "border-status-draft/60";
    case "pending_review":
      return "border-status-pending/55";
    case "rejected":
      return "border-status-rejected/55";
    case "processing":
      return "border-status-processing/55";
    case "published":
      return "border-status-published/55";
    case "unlisted":
      return "border-status-unlisted/55";
    default:
      return "border-border";
  }
}
