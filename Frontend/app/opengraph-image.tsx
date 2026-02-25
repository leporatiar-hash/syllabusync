import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "ClassMate – Parse syllabi, track deadlines, and study smarter.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const owlData = await fetch(
    new URL("../public/brand/classmate-owl.png", import.meta.url)
  ).then((res) => res.arrayBuffer());

  const owlBase64 = `data:image/png;base64,${Buffer.from(owlData).toString("base64")}`;

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
        <img
          src={owlBase64}
          width="160"
          height="160"
          style={{ marginBottom: 24 }}
        />

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
