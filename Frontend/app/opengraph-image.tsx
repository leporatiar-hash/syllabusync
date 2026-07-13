import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "ClassMate — The AI that knows your entire semester.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          background: "#5B4EE8",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 32 32">
          <rect x="5.4" y="7.3" width="21.2" height="21.2" rx="9.4" fill="#fff" />
          <path d="M10 7.5 6.6 1.3 13.5 6Z" fill="#fff" />
          <path d="M22 7.5 25.4 1.3 18.5 6Z" fill="#fff" />
          <circle cx="9.8" cy="15.4" r="2.6" fill="#5B4EE8" />
          <circle cx="22.2" cy="15.4" r="2.6" fill="#5B4EE8" />
          <path d="M14.5 18.8h3l-1.5 2.6-1.5-2.6Z" fill="#5B4EE8" />
        </svg>

        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
            marginTop: 28,
          }}
        >
          ClassMate
        </div>
      </div>
    ),
    { ...size }
  );
}
