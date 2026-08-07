"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="main-with-sidebar">
        <div className="page-content">
          <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="منو">
            <Menu size={19} />
          </button>
          {children}
        </div>
      </main>
    </div>
  );
}
