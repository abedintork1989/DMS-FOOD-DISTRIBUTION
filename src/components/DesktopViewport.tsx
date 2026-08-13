"use client";

import {
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type DesktopViewportProps = {
  children: ReactNode;
  /**
   * عرض مرجع کل برنامه روی دسکتاپ.
   * کل UI روی موبایل دقیقاً از همین عرض Scale می‌شود.
   */
  baseWidth?: number;
};

export default function DesktopViewport({
  children,
  baseWidth = 1280,
}: DesktopViewportProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null);

  const updateViewport = useCallback(() => {
    const viewportWidth = window.innerWidth;

    // روی دسکتاپ بزرگ‌تر از عرض پایه، Layout بدون بزرگ‌نمایی می‌ماند.
    // روی موبایل/تبلت کل Desktop Layout کوچک می‌شود.
    const nextScale = Math.min(1, viewportWidth / baseWidth);

    setScale(nextScale);

    if (canvasRef.current) {
      const height = canvasRef.current.scrollHeight;
      setCanvasHeight(height * nextScale);
    }
  }, [baseWidth]);

  useEffect(() => {
    updateViewport();

    const handleResize = () => {
      updateViewport();
    };

    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;

    if (canvasRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateViewport();
      });

      observer.observe(canvasRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [updateViewport]);

  useEffect(() => {
    // بعد از لود فونت/عکس/جدول‌ها دوباره ارتفاع واقعی Canvas را بگیر.
    const timer = window.setTimeout(updateViewport, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [children, updateViewport]);

  const outerStyle: CSSProperties = {
    width: "100vw",
    maxWidth: "100vw",
    overflowX: "hidden",
    overflowY: "visible",
    position: "relative",
    display: "flex",
    justifyContent: "center",
  };

  const canvasStyle: CSSProperties = {
    width: `${baseWidth}px`,
    minWidth: `${baseWidth}px`,
    transform: `scale(${scale})`,
    transformOrigin: scale < 1 ? "top left" : "top center",
    position: "relative",
    willChange: "transform",
    marginLeft: scale >= 1 ? "auto" : 0,
    marginRight: scale >= 1 ? "auto" : 0,
  };

  return (
    <div
      className="desktop-viewport"
      style={{
        ...outerStyle,
        height:
          scale < 1 && canvasHeight !== null
            ? `${Math.max(canvasHeight, 1)}px`
            : "auto",
      }}
    >
      <div
        ref={canvasRef}
        className="desktop-canvas"
        style={canvasStyle}
      >
        {children}
      </div>
    </div>
  );
}
