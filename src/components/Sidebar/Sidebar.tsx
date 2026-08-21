"use client";
import "./sidebar.css";
import { useState } from "react";
import SidebarRail from "./SidebarRail";
import SidebarPanel from "./SidebarPanel";

export default function Sidebar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  function handleMenuClick(id: string) {
    setActiveMenu((current) => (current === id ? null : id));
  }

  return (
    <div
      className={
        activeMenu
          ? "sidebar-wrapper menu-open"
          : "sidebar-wrapper"
      }
    >
      <SidebarRail
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
      />
      <SidebarPanel
        activeMenu={activeMenu}
        onClose={() => setActiveMenu(null)}
      />
    </div>
  );
}