"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

import VisitorProfile from "@/components/visitors/VisitorProfile";
import VisitorMap from "@/components/visitors/VisitorMap";
import VisitorTerritories from "@/components/visitors/VisitorTerritories";

export default function VisitorDetailPage() {
  const params = useParams<{ id: string }>();

  const [visitor, setVisitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVisitor();
  }, []);

  async function loadVisitor() {
    try {
      const { data, error } = await supabase
        .from("sales_visitors")
        .select(`
          *,
          sales_channel:sales_channels(
            name
          ),
          sales_visitor_territories(
            province,
            region
          )
        `)
        .eq("id", params.id)
        .single();

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      setVisitor({
        ...data,
        territories: data.sales_visitor_territories || [],
      });
    } catch (error) {
      console.error("LOAD VISITOR ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div>در حال دریافت اطلاعات...</div>
      </AppShell>
    );
  }

  if (!visitor) {
    return (
      <AppShell>
        <div>ویزیتور پیدا نشد</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: 20,
        }}
      >
        <div>
          <VisitorProfile visitor={visitor} />

          <VisitorTerritories
            territories={visitor.territories}
          />
        </div>

        <VisitorMap />
      </div>
    </AppShell>
  );
}