"use client";
import { useRouter } from "next/navigation";
import { UserRound, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sidebarMenus } from "./menuConfig";

type Props = {
  activeMenu: string | null;
  onMenuClick: (id: string) => void;
};

export default function SidebarRail({
  activeMenu,
  onMenuClick,
}: Props) {
  const router = useRouter();

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <aside
      className={
        activeMenu
          ? "sidebar-rail expanded"
          : "sidebar-rail"
      }
    >
      <div className="sidebar-logo">SSM</div>

      <div className="sidebar-icons">
        {sidebarMenus.map((item: any) => {
          const Icon = item.icon;
          const active = activeMenu === item.id;
          return (
            <button
              key={item.id}
              className={
  active
    ? `sidebar-icon-button active ${item.positionClass || ""}`
    : `sidebar-icon-button ${item.positionClass || ""}`
}
              onClick={() => {
                if (item.disabled) return;
                if (item.children) {
                  onMenuClick(item.id);
                  return;
                }
                if (item.path) {
                  router.push(item.path);
                }
              }}
            >
              <Icon size={24} />
              {activeMenu && (
                <span className="main-menu-title">{item.title}</span>
              )}
              {/* قوس پایین برای اتصال نرم */}
              {active && <span className="curve-bottom" />}
            </button>
          );
        })}
      </div>

      <div className="sidebar-bottom-actions">
        <button 
  className="sidebar-icon-button menu-profile-position" 
  type="button"
>
          <UserRound size={24} />
          {activeMenu && <span className="main-menu-title">پروفایل</span>}
        </button>
        <button
  className="sidebar-icon-button menu-logout-position"
  type="button"
  onClick={logout}
>
          <LogOut size={24} />
          {activeMenu && <span className="main-menu-title">خروج</span>}
        </button>
      </div>
    </aside>
  );
}