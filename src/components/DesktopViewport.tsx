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
  baseWidth?: number;
};

export default function DesktopViewport({
  children,
  baseWidth = 1280,
}: DesktopViewportProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(1);

  const updateViewport = useCallback(() => {
    const viewportWidth = Math.max(window.innerWidth, 1);

    // Desktop stays at the original design size.
    // On smaller screens, the complete desktop UI scales down to fit.
    const nextScale = Math.min(1, viewportWidth / baseWidth);

    setScale(nextScale);

    if (canvasRef.current) {
      const measuredHeight = Math.max(
        canvasRef.current.scrollHeight,
        canvasRef.current.offsetHeight,
        1
      );

      setContentHeight(measuredHeight);
    }
  }, [baseWidth]);

  useEffect(() => {
    updateViewport();

    const handleResize = () => updateViewport();

    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;

    if (canvasRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        requestAnimationFrame(updateViewport);
      });

      observer.observe(canvasRef.current);
    }

    const firstMeasure = window.setTimeout(updateViewport, 100);
    const secondMeasure = window.setTimeout(updateViewport, 500);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
      window.clearTimeout(firstMeasure);
      window.clearTimeout(secondMeasure);
    };
  }, [updateViewport, children]);

  const stageWidth = baseWidth * scale;
  const stageHeight = Math.max(contentHeight * scale, 1);

  const stageStyle: CSSProperties = {
    width: `${stageWidth}px`,
    height: `${stageHeight}px`,
    maxWidth: "100vw",
    marginLeft: "auto",
    marginRight: "auto",
    position: "relative",
    overflow: "visible",
  };

  const canvasStyle: CSSProperties = {
    width: `${baseWidth}px`,
    minWidth: `${baseWidth}px`,
    position: "absolute",
    top: 0,
    left: 0,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    willChange: "transform",
  };

  return (
    <div
      className="desktop-viewport"
      style={{
        width: "100%",
        maxWidth: "100%",
        minHeight: "100vh",
        overflowX: "hidden",
        overflowY: "visible",
        position: "relative",
      }}
    >
      <div
        className="desktop-scale-stage"
        style={stageStyle}
      >
        <div
          ref={canvasRef}
          className="desktop-canvas"
          style={canvasStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
