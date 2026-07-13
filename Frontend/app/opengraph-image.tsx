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
        <svg width="220" height="220" viewBox="0 0 512 512">
          <path
            d="M368 168 A128 128 0 1 0 368 344"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="76"
            strokeLinecap="round"
          />
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
