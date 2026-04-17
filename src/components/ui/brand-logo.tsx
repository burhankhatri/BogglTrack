import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  /** Pixel size of the rendered tile. Default 28. */
  size?: number;
  className?: string;
}

/**
 * The BogglTrack brand mark — the same tile used as the favicon, app icon,
 * and DMG icon. Centralized so any future logo change flows everywhere.
 * The source PNG is a pre-composed tile (light background + black logo),
 * so we don't wrap it in an outer container — the image IS the logo.
 */
export function BrandLogo({ size = 28, className }: Props) {
  return (
    <Image
      src="/logo.png"
      alt="BogglTrack"
      width={size}
      height={size}
      priority
      className={cn("rounded-md shrink-0 select-none", className)}
    />
  );
}
