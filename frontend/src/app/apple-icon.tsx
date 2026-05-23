import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0e0c",
        }}
      >
        {/* 150×150 gives 15px padding each side — keeps handle clear of iOS squircle corners */}
        <svg width="150" height="150" viewBox="0 0 512 512">
          <circle cx="256" cy="268" r="118" fill="#e8a54b" stroke="#b87d2e" strokeWidth="12" />
          <circle cx="256" cy="268" r="78" fill="#0f0e0c" opacity="0.35" />
          <path d="M374 168 L440 102" stroke="#f5efe6" strokeWidth="28" strokeLinecap="round" />
          <ellipse cx="256" cy="268" rx="42" ry="18" fill="#f5efe6" opacity="0.2" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
