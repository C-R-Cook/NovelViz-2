type Props = {
  className?: string;
};

/** Faded bottom scrim for image thumbnails — keeps metadata readable over busy artwork. */
export function ImageThumbnailBottomBar({ className }: Props) {
  return (
    <div
      className={className ? `image-thumb-bottom-bar ${className}` : "image-thumb-bottom-bar"}
      aria-hidden
    />
  );
}
