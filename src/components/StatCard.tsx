import type { LucideIcon } from "lucide-react";

export default function StatCard({
  title,
  value,
  icon: Icon,
  hint
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-title">{title}</div>
        <div className="stat-icon"><Icon size={20} /></div>
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div style={{ color: "#64748b", fontSize: 11, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
