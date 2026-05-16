"use client";

type Props = {
  imageChapter: number;
  spoilerGateChapter: number;
};

export function CommentPendingSpoilerNotice({ imageChapter, spoilerGateChapter }: Props) {
  const spoilLine =
    spoilerGateChapter !== imageChapter
      ? `May contain spoilers for chapter ${spoilerGateChapter}.`
      : "May contain spoilers for this chapter.";

  return (
    <p className="mt-2 text-xs leading-relaxed text-error" role="note">
      <span className="font-medium">Under review.</span> Illustration from chapter {imageChapter}. {spoilLine}
    </p>
  );
}
