"use client";

import { ReactNode, useEffect, useState } from "react";

type DesktopViewportProps = {
  children: ReactNode;
  baseWidth?: number;
};

export default function DesktopViewport({
  children,
  baseWidth = 1280,
}: DesktopViewportProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const width = Math.max(window.innerWidth, 1);
      setScale(Math.min(1, width / baseWidth));
    };

    updateScale();
    window.addEventListener("resize", updateScale);

    return () => {
      window.removeEventListener("resize", updateScale);
    };
  }, [baseWidth]);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        overflowX: "hidden",
        overflowY: "visible",
        position: "relative",
      }}
    >
      <div
        style={{
          width: `${baseWidth}px`,
          minWidth: `${baseWidth}px`,
          marginLeft: "auto",
          marginRight: "auto",
          flexShrink: 0,
          zoom: scale,
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}
