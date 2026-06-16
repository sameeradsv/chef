"use client";

import { useEffect, useRef, useState } from "react";
import { api, type BarcodeResult } from "@/lib/api";

interface Props {
  onDetected: (barcode: string, product?: BarcodeResult, storageType?: string) => void;
  onClose: () => void;
}

const STORAGE_OPTIONS = ["pantry", "fridge", "freezer"] as const;

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"scanning" | "looking-up" | "confirm" | "error">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const [detectedBarcode, setDetectedBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeResult | null>(null);
  const [qty, setQty] = useState<string>("");
  const [storageType, setStorageType] = useState<typeof STORAGE_OPTIONS[number]>("pantry");
  const detectedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width:  { ideal: 1920 },
              height: { ideal: 1080 },
              // continuous autofocus — keeps the camera sharp as you move closer/further
              // "advanced" constraints are silently ignored if the device doesn't support them
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            },
          },
          videoRef.current!,
          async (result) => {
            if (result && !detectedRef.current && !cancelled) {
              detectedRef.current = true;
              controlsRef.current?.stop();
              const barcode = result.getText();
              setDetectedBarcode(barcode);
              setStatus("looking-up");
              try {
                const p = await api.lookupBarcode(barcode);
                setProduct(p);
                setQty(String(p.quantity || ""));
                setStatus("confirm");
              } catch {
                // Product not found — still let user confirm with just the barcode
                setProduct(null);
                setStatus("confirm");
              }
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
  }, []);

  function handleConfirm() {
    const finalProduct = product
      ? { ...product, quantity: parseFloat(qty) || product.quantity }
      : undefined;
    onDetected(detectedBarcode, finalProduct, storageType);
  }

  function handleRescan() {
    detectedRef.current = false;
    setDetectedBarcode("");
    setProduct(null);
    setStatus("scanning");
    // Restart scanner
    controlsRef.current = null;
    window.location.reload(); // simplest rescan — remount would need state lift
  }

  const isConfirm = status === "confirm" || status === "looking-up";

  return (
    <div className="fixed inset-0 z-[100]" style={{ background: "#0a0a0a" }}>
      {/* Full-bleed camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: isConfirm ? 0.25 : 1 }}
      />

      {/* Dark radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.65) 100%)" }}
      />

      {/* Top controls */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-5" style={{ paddingTop: "calc(20px + env(safe-area-inset-top, 0px))" }}>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center text-white transition-opacity hover:opacity-80"
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
          aria-label="Close scanner"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
        <button
          type="button"
          className="flex items-center justify-center text-white opacity-50 cursor-not-allowed"
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
          aria-label="Flash (not available)"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2L4 9h5l-2 5 7-8H9l2-4z" />
          </svg>
        </button>
      </div>

      {/* Centered reticle — only when scanning */}
      {status === "scanning" && (
        <div
          className="absolute"
          style={{
            width: 240, height: 200,
            top: "50%", left: "50%",
            transform: "translate(-50%, -58%)",
          }}
        >
          {/* Four corner brackets */}
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <div
              key={c}
              className="absolute"
              style={{
                width: 36, height: 36,
                top:    c.startsWith("t") ? 0 : "auto",
                bottom: c.startsWith("b") ? 0 : "auto",
                left:   c.endsWith("l")   ? 0 : "auto",
                right:  c.endsWith("r")   ? 0 : "auto",
                borderTop:    c.startsWith("t") ? "3px solid #e4a050" : "none",
                borderBottom: c.startsWith("b") ? "3px solid #e4a050" : "none",
                borderLeft:   c.endsWith("l")   ? "3px solid #e4a050" : "none",
                borderRight:  c.endsWith("r")   ? "3px solid #e4a050" : "none",
                borderRadius:
                  c === "tl" ? "4px 0 0 0"
                  : c === "tr" ? "0 4px 0 0"
                  : c === "bl" ? "0 0 0 4px"
                  : "0 0 4px 0",
              }}
            />
          ))}

          {/* Ghostly barcode lines */}
          <div className="absolute" style={{ top: "40%", left: "12%", right: "12%", display: "flex", gap: 3, alignItems: "center", height: 40, opacity: 0.18 }}>
            {Array.from({ length: 22 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1,
                  height: i % 4 === 0 ? 40 : i % 3 === 0 ? 30 : 22,
                  background: "#e4a050",
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Glowing scan line */}
          <div
            className="absolute animate-scan-line"
            style={{
              left: "8%", right: "8%",
              top: "50%", height: 1.5,
              background: "linear-gradient(90deg, transparent 0%, #e4a050 20%, #e4a050 80%, transparent 100%)",
              marginTop: -1,
            }}
          />
        </div>
      )}

      {/* Detected pill */}
      {isConfirm && (
        <div
          className="absolute flex items-center gap-2 px-4 py-2 text-[11px] font-mono"
          style={{
            top: "40%", left: "50%", transform: "translate(-50%, -50%)",
            background: "rgba(14,12,10,0.88)", backdropFilter: "blur(12px)",
            borderRadius: 999, border: "1px solid rgba(228,160,80,0.45)",
            color: "#e4a050", letterSpacing: "0.1em", whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e4a050", display: "inline-block", flexShrink: 0 }} />
          {status === "looking-up" ? "LOOKING UP PRODUCT…" : "DETECTED — CONFIRM BELOW"}
        </div>
      )}

      {/* Status text when scanning */}
      {status === "scanning" && (
        <div className="absolute text-center px-4" style={{ top: "calc(50% + 110px)", left: 0, right: 0 }}>
          <p className="text-white text-[11px] font-mono tracking-[0.15em]">ALIGN THE VERTICAL STRIPES IN THE BOX</p>
          <p className="text-white/50 text-[10px] font-mono tracking-[0.08em] mt-1">hold 15–20 cm away · not the numbers, the bars above them</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[#e4a050] text-sm font-mono tracking-wide">{errorMsg}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 text-xs font-mono tracking-widest hover:text-white/90 transition-colors"
          >
            CLOSE
          </button>
        </div>
      )}

      {/* Bottom product overlay — shown after detection */}
      {isConfirm && (
        <div
          className="absolute bottom-0 left-0 right-0 animate-fade-in"
          style={{
            background: "rgba(14,12,10,0.94)",
            backdropFilter: "blur(16px)",
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderTop: "1px solid rgba(255,220,180,0.12)",
            padding: "20px 22px",
            paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Drag handle */}
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,220,180,0.15)", margin: "0 auto 16px" }} />

          {status === "looking-up" ? (
            <div className="flex justify-center py-6">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#e4a050", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Product preview */}
              {product ? (
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="flex-shrink-0"
                    style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: "linear-gradient(135deg, rgba(228,160,80,0.25), rgba(160,112,58,0.15))",
                      border: "1px solid rgba(228,160,80,0.2)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {product.brand && (
                      <p className="text-[10px] font-mono tracking-[0.1em] uppercase" style={{ color: "rgba(194,178,154,0.7)" }}>{product.brand}</p>
                    )}
                    <p className="text-sm font-display font-normal leading-snug" style={{ color: "#f4ece0" }}>
                      {product.ingredient_name || product.product_name}
                    </p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(194,178,154,0.6)" }}>
                      {product.quantity}{product.unit}
                      {product.nutrition_score > 0 ? ` · ${product.nutrition_score} kcal/100g` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-sm font-mono" style={{ color: "rgba(194,178,154,0.8)" }}>
                    Barcode: <span style={{ color: "#e4a050" }}>{detectedBarcode}</span>
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(194,178,154,0.5)" }}>Product not found in database — you can still add it manually.</p>
                </div>
              )}

              {/* Quantity + Storage row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.1em] uppercase mb-1.5" style={{ color: "rgba(194,178,154,0.6)" }}>QUANTITY</p>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder={product ? String(product.quantity) : "1"}
                    className="w-full text-sm px-3 py-2 outline-none focus:ring-1"
                    style={{
                      background: "rgba(255,220,180,0.06)", border: "1px solid rgba(255,220,180,0.14)",
                      borderRadius: 10, color: "#f4ece0",
                    }}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-mono tracking-[0.1em] uppercase mb-1.5" style={{ color: "rgba(194,178,154,0.6)" }}>STORAGE</p>
                  <select
                    value={storageType}
                    onChange={(e) => setStorageType(e.target.value as typeof STORAGE_OPTIONS[number])}
                    className="w-full text-sm px-3 py-2 outline-none"
                    style={{
                      background: "rgba(255,220,180,0.06)", border: "1px solid rgba(255,220,180,0.14)",
                      borderRadius: 10, color: "#f4ece0",
                    }}
                  >
                    {STORAGE_OPTIONS.map((o) => <option key={o} value={o} style={{ background: "#1d1815" }}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ background: "#e4a050", color: "rgb(26 18 10)", borderRadius: 12 }}
                >
                  Add to pantry
                </button>
                <button
                  type="button"
                  onClick={handleRescan}
                  className="px-4 py-3 text-sm transition-opacity hover:opacity-70"
                  style={{ border: "1px solid rgba(255,220,180,0.18)", borderRadius: 12, color: "rgba(194,178,154,0.8)" }}
                >
                  Wrong product?
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
