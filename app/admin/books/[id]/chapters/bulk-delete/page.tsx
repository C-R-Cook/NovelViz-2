import { ADMIN_BULK_CHAPTER_DELETE_HREF } from "@/lib/admin-book-navigation";
import { redirect } from "next/navigation";

/** Legacy per-book URL — bulk delete is global under Helpers. */
export default function LegacyBulkChapterDeleteRedirect() {
  redirect(ADMIN_BULK_CHAPTER_DELETE_HREF);
}
