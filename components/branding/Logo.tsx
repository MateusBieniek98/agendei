// Logo GN — versão SVG inline. Mantém fidelidade ao símbolo da empresa
// (pinheiro estilizado + monograma "GN") e escala bem em qualquer tamanho.

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
  const blue = "#2f80ed";
  const fg =
    variant === "mono-light"
      ? "#ffffff"
      : variant === "mono-dark"
      ? "#0f172a"
      : blue;

  return (
    <span className={"inline-flex items-center gap-2 " + (className ?? "")}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="GN"
        role="img"
      >
        {/* pinheiro estilizado (curvas livres) */}
        <path
          d="M28 12c-3 6-9 8-12 14 4-1 6 1 7 4-4 2-9 6-11 12 5-1 8 1 10 4-4 3-9 8-10 16 6-2 10 0 13 3-3 4-6 8-6 14h22V14c-5-2-9-3-13-2z"
          fill={fg}
        />
        {/* tronco */}
        <rect x="33" y="76" width="6" height="10" fill={fg} />
        {/* G */}
        <path
          d="M58 32h22a4 4 0 0 1 4 4v6h-9v-2H62v22h13v-6h-7v-7h16v17a4 4 0 0 1-4 4H58a4 4 0 0 1-4-4V36a4 4 0 0 1 4-4z"
          fill={fg}
        />
      </svg>
      {withWordmark && (
        <span
          className="font-bold tracking-tight"
          style={{ color: fg, fontSize: size * 0.55 }}
        >
          GN
        </span>
      )}
    </span>
  );
}
