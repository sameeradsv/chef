import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 512 512">
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
