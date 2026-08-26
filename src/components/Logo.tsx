/**
 * The Mirantic mark, shared by every surface in the app so the placeholder "M"
 * tile cannot creep back in.
 *
 * The wordmark is the real artwork rather than the app's own typeface — it
 * carries the star and its letterforms — and ships from this app's own public/
 * folder so the sign-in screen does not depend on the marketing site being up.
 */

/** The star, matching the marketing site's inline mark exactly. */
const STAR = "M100 20 Q113 87 180 100 Q113 113 100 180 Q87 113 20 100 Q87 87 100 20 Z";

export function StarMark({
  size = 20,
  tone = "dark",
  className = "",
}: {
  size?: number;
  /** "light" for dark backgrounds. */
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={STAR} fill={tone === "light" ? "#46c5f2" : "#1e7fc2"} />
    </svg>
  );
}

export function Logo({
  height = 18,
  tone = "dark",
  className = "",
}: {
  height?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <img
      src={tone === "light" ? "/brand/logo-reversed-trimmed.png" : "/brand/logo-primary-trimmed.png"}
      alt="Mirantic"
      height={height}
      style={{ height, width: "auto" }}
      className={"block shrink-0 " + className}
      draggable={false}
    />
  );
}
