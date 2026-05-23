"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"scanning" | "detected" | "error">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const detectedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (result && !detectedRef.current && !cancelled) {
              detectedRef.current = true;
              setStatus("detected");
              controls.stop();
              onDetected(result.getText());
            }
          }
        );
        controlsRef.current = controls;
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "";
          setErrorMsg(
            msg.toLowerCase().includes("permission")
              ? "Camera permission denied"
              : "Camera unavailable"
          );
          setStatus("error");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{ background: "rgba(0,0,0,0.96)" }}
    >
      {/* Viewfinder */}
      <div className="relative" style={{ width: 280, height: 280 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ borderRadius: 16 }}
        />
        {/* Corner brackets */}
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <div
            key={corner}
            className="absolute w-7 h-7"
            style={{
              top:    corner.startsWith("t") ? 8 : "auto",
              bottom: corner.startsWith("b") ? 8 : "auto",
              left:   corner.endsWith("l")   ? 8 : "auto",
              right:  corner.endsWith("r")   ? 8 : "auto",
              borderTop:    corner.startsWith("t") ? "2px solid rgb(var(--kitchen-accent))" : "none",
              borderBottom: corner.startsWith("b") ? "2px solid rgb(var(--kitchen-accent))" : "none",
              borderLeft:   corner.endsWith("l")   ? "2px solid rgb(var(--kitchen-accent))" : "none",
              borderRight:  corner.endsWith("r")   ? "2px solid rgb(var(--kitchen-accent))" : "none",
              borderRadius:
                corner === "tl" ? "4px 0 0 0"
                : corner === "tr" ? "0 4px 0 0"
                : corner === "bl" ? "0 0 0 4px"
                : "0 0 4px 0",
            }}
          />
        ))}
        {/* Scan line */}
        {status === "scanning" && (
          <div
            className="absolute left-3 right-3 h-px animate-bounce"
            style={{ background: "rgb(var(--kitchen-accent) / 0.6)", top: "50%" }}
          />
        )}
      </div>

      <div className="text-center space-y-1 px-8">
        {status === "scanning" && (
          <>
            <p className="text-white text-sm font-mono tracking-wide">POINT AT BARCODE</p>
            <p className="text-white/40 text-xs">Works on packaged food products</p>
          </>
        )}
        {status === "detected" && (
          <p className="text-sm font-mono tracking-wide" style={{ color: "rgb(var(--kitchen-accent))" }}>
            BARCODE DETECTED
          </p>
        )}
        {status === "error" && (
          <p className="text-red-400 text-sm font-mono">{errorMsg}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="text-white/50 text-xs font-mono tracking-widest hover:text-white/80 transition-colors"
      >
        CANCEL
      </button>
    </div>
  );
}
