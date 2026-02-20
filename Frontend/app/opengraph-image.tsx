import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "ClassMate – Parse syllabi, track deadlines, and study smarter.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #f0f7ff 0%, #e0edff 50%, #d4e6ff 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Owl icon using SVG */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 120"
          fill="none"
          style={{ marginBottom: 24 }}
        >
          {/* Simplified owl shape */}
          <ellipse cx="50" cy="45" rx="35" ry="32" stroke="#4A90E2" strokeWidth="5" fill="none" />
          {/* Eyes */}
          <circle cx="38" cy="40" r="6" fill="#4A90E2" />
          <circle cx="62" cy="40" r="6" fill="#4A90E2" />
          {/* Beak */}
          <path d="M46 52 L50 58 L54 52" stroke="#4A90E2" strokeWidth="3" fill="none" />
          {/* Body */}
          <path d="M25 70 Q50 110 75 70" stroke="#4A90E2" strokeWidth="5" fill="none" />
          {/* Feet */}
          <path d="M38 95 L32 105 M38 95 L38 105 M38 95 L44 105" stroke="#4A90E2" strokeWidth="3" />
          <path d="M62 95 L56 105 M62 95 L62 105 M62 95 L68 105" stroke="#4A90E2" strokeWidth="3" />
        </svg>

        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#7BB7FF",
            letterSpacing: "-0.02em",
          }}
        >
          ClassMate
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#64748b",
            marginTop: 12,
          }}
        >
          Parse syllabi, track deadlines, and study smarter.
        </div>
      </div>
    ),
    { ...size }
  );
}
