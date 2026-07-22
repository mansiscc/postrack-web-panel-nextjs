import Link from "next/link";

export function SkipToMain() {
  return (
    <Link
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-3 focus:ring-ring/50"
    >
      Skip to main content
    </Link>
  );
}
