/** Mobile tab bar + safe area — keep in sync with Layout.tsx and globals.css `--content-bottom-inset` */
import type { CSSProperties } from "react";

export const MOBILE_TAB_BAR_HEIGHT_PX = 57;

export const sheetFooterPadding = "max(16px, env(safe-area-inset-bottom, 0px))";

export const sheetOverlayCompactClass =
  "fixed inset-0 z-[100] flex items-end md:items-center justify-center";

export const sheetOverlayTallClass =
  "fixed inset-0 z-[100] flex flex-col md:items-center md:justify-center md:p-4";

export const sheetPanelTallClass =
  "flex flex-col w-full h-full min-h-0 md:h-auto md:max-h-[90dvh] md:max-w-md animate-fade-in";

export const sheetPanelCompactClass = "w-full max-w-md animate-fade-in";

export const sheetOverlayStyle: CSSProperties = {
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(4px)",
};

export const sheetPanelStyle: CSSProperties = {
  background: "rgb(var(--kitchen-bg))",
  borderTop: "1px solid var(--kitchen-line2)",
  borderRadius: "var(--radius-card) var(--radius-card) 0 0",
};

export const sheetFooterStyle: CSSProperties = {
  borderTop: "1px solid var(--kitchen-line)",
  paddingBottom: sheetFooterPadding,
  background: "rgb(var(--kitchen-bg))",
};
