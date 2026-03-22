import React from "react";

interface Props {
  status: "configured" | "missing" | "valid" | "invalid" | "checking";
  label?: string;
}

const COLORS: Record<string, { bg: string; fg: string }> = {
  configured: { bg: "#e8f5e9", fg: "#2e7d32" },
  valid:      { bg: "#e8f5e9", fg: "#2e7d32" },
  missing:    { bg: "#fbe9e7", fg: "#c62828" },
  invalid:    { bg: "#fff3e0", fg: "#e65100" },
  checking:   { bg: "#e3f2fd", fg: "#1565c0" },
};

export default function StatusBadge({ status, label }: Props) {
  const c = COLORS[status] ?? COLORS.missing;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        background: c.bg,
        color: c.fg,
      }}
    >
      {label ?? status}
    </span>
  );
}
