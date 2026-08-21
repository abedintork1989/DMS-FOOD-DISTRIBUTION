"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarMenus } from "./menuConfig";

type Props = {
  activeMenu: string | null;
  onClose: () => void;
};

export default function SidebarPanel({
  activeMenu,
  onClose,
}: Props) {
  const pathname = usePathname();
  const menu = sidebarMenus.find((item) => item.id === activeMenu);

  if (!menu || !menu.children) {
    return null;
  }

  return (
    <section className="sidebar-panel">
      <div className="sidebar-panel-header">
        <h3>{menu.title}</h3>
        <button onClick={onClose}>×</button>
      </div>
      <div className="sidebar-submenu-list">
        {menu.children.map((child) => {
          const Icon = child.icon;
          const isActive = pathname === child.path;
          return (
            <Link
              key={child.path}
              href={child.path}
              className={
                isActive
                  ? "sidebar-submenu-item active"
                  : "sidebar-submenu-item"
              }
            >
              <div className="sidebar-submenu-icon">
                {Icon && <Icon size={22} />}
              </div>
              <span>{child.title}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}