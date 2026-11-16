/** The numeral and arrow share one coordinate system; neither depends on button padding. */
export function SeekStepIcon({ forward = false }: { forward?: boolean }) {
  return (
    <svg
      className="seek-step-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        transform={forward ? "translate(24 0) scale(-1 1)" : undefined}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 9a8 8 0 1 1-.2 6" />
        <path d="M4 4v5h5" />
      </g>
      <text
        x="12"
        y="13"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        stroke="none"
        fontFamily="Geist, sans-serif"
        fontSize="7.5"
        fontWeight="650"
      >
        10
      </text>
    </svg>
  );
}
