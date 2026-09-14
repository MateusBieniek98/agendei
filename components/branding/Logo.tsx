import { PRODUCT_BRAND } from "@/lib/product-brand";

type Props = {
  size?: number;
  variant?: "color" | "mono-light" | "mono-dark";
  withWordmark?: boolean;
  className?: string;
};

export default function Logo({
  size = 36,
  variant = "color",
  withWordmark = false,
  className,
}: Props) {
  const wordmark =
    variant === "mono-light"
      ? "#ffffff"
      : variant === "mono-dark"
        ? PRODUCT_BRAND.colors.graphite
        : PRODUCT_BRAND.colors.pine;
  const background = variant === "color" ? PRODUCT_BRAND.colors.pine : "none";
  const foreground =
    variant === "mono-dark" ? PRODUCT_BRAND.colors.pine : "#f7f7f2";
  const accent = variant === "color" ? PRODUCT_BRAND.colors.amber : foreground;

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={PRODUCT_BRAND.name}
        role="img"
      >
        <rect x="5" y="5" width="86" height="86" rx="19" fill={background} />
        <path
          d="M24 26h48M48 27v44"
          fill="none"
          stroke={foreground}
          strokeWidth="8"
          strokeLinecap="square"
        />
        <path
          d="m23 72 15-31M73 72 58 41"
          fill="none"
          stroke={accent}
          strokeWidth="5"
          strokeLinecap="square"
        />
      </svg>
      {withWordmark && (
        <span
          className="truncate font-semibold"
          style={{ color: wordmark, fontSize: Math.max(14, size * 0.44) }}
        >
          {PRODUCT_BRAND.shortName}
        </span>
      )}
    </span>
  );
}
