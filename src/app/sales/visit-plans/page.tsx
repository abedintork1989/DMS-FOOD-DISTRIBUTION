"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, GripVertical, Plus, Save, Trash2, UserRound } from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

type Visitor = {
  id: string;
  full_name: string;
  phone: string | null;
  active: boolean;
};

type Customer = {
  id: string;
  name: string;
  province: string | null;
  address: string | null;
  phone: string | null;
  sales_visitor_id: string | null;
  active: boolean | null;
};

type PlanRow = {
  id: string;
  visitor_id: string;
  plan_date: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
};

type PlanItem = {
  id: string;
  visit_plan_id: string;
  customer_id: string;
  sequence_no: number | null;
  planned_time: string | null;
  is_target: boolean;
  status: "planned" | "visited" | "missed" | "cancelled";
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const statusLabel: Record<PlanRow["status"], string> = {
  planned: "برنامه‌ریزی‌شده",
  in_progress: "در حال اجرا",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};

const itemStatusLabel: Record<PlanItem["status"], string> = {
  planned: "برنامه‌ریزی‌شده",
  visited: "ویزیت‌شده",
  missed: "ویزیت‌نشده",
  cancelled: "لغوشده",
};

export default function SalesVisitPlansPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [selectedVisitorId, setSelectedVisitorId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [customerSearch, setCustomerSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!selectedVisitorId || !selectedDate) return;
    void loadPlan();
  }, [selectedVisitorId, selectedDate]);

  async function loadBase() {
    setLoading(true);

    try {
      const [visitorsResult, customersResult] = await Promise.all([
        supabase
          .from("sales_visitors")
          .select("id,full_name,phone,active")
          .eq("active", true)
          .order("full_name", { ascending: true }),

        supabase
          .from("customers")
          .select(
            "id,name,province,address,phone,sales_visitor_id,active"
          )
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

      if (visitorsResult.error) throw visitorsResult.error;
      if (customersResult.error) throw customersResult.error;

      const visitorRows = (visitorsResult.data || []) as Visitor[];
      setVisitors(visitorRows);
      setCustomers((customersResult.data || []) as Customer[]);

      if (!selectedVisitorId && visitorRows.length) {
        setSelectedVisitorId(visitorRows[0].id);
      }
    } catch (error: any) {
      alert(`خطا در دریافت اطلاعات برنامه ویزیت:\n${error?.message || "نامشخص"}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlan() {
    setLoading(true);

    try {
      const { data: planRow, error: planError } = await supabase
        .from("sales_visit_plans")
        .select("id,visitor_id,plan_date,status")
        .eq("visitor_id", selectedVisitorId)
        .eq("plan_date", selectedDate)
        .maybeSingle();

      if (planError) throw planError;

      if (!planRow) {
        setPlan(null);
        setItems([]);
        return;
      }

      const { data: itemRows, error: itemError } = await supabase
        .from("sales_visit_plan_items")
        .select(
          "id,visit_plan_id,customer_id,sequence_no,planned_time,is_target,status"
        )
        .eq("visit_plan_id", planRow.id)
        .order("sequence_no", { ascending: true });

      if (itemError) throw itemError;

      setPlan(planRow as PlanRow);
      setItems((itemRows || []) as PlanItem[]);
    } catch (error: any) {
      alert(`خطا در دریافت برنامه:\n${error?.message || "نامشخص"}`);
    } finally {
      setLoading(false);
    }
  }

  const assignedCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.sales_visitor_id === selectedVisitorId
      ),
    [customers, selectedVisitorId]
  );

  const availableCustomers = useMemo(() => {
    const currentIds = new Set(items.map((item) => item.customer_id));
    const query = customerSearch.trim().toLocaleLowerCase("fa-IR");

    return assignedCustomers.filter((customer) => {
      if (currentIds.has(customer.id)) return false;
      if (!query) return true;

      const text = [
        customer.name,
        customer.province || "",
        customer.address || "",
        customer.phone || "",
      ]
        .join(" ")
        .toLocaleLowerCase("fa-IR");

      return text.includes(query);
    });
  }, [assignedCustomers, customerSearch, items]);

  const orderedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.sequence_no || 999999) -
          (b.sequence_no || 999999)
      ),
    [items]
  );

  function addCustomer(customer: Customer) {
    setItems((current) => [
      ...current,
      {
        id: `temp-${customer.id}-${Date.now()}`,
        visit_plan_id: plan?.id || "",
        customer_id: customer.id,
        sequence_no: current.length + 1,
        planned_time: null,
        is_target: true,
        status: "planned",
      },
    ]);

    setCustomerSearch("");
  }

  function removeCustomer(id: string) {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      return next.map((item, index) => ({
        ...item,
        sequence_no: index + 1,
      }));
    });
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const next = [...current];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return current;

      [next[index], next[targetIndex]] = [
        next[targetIndex],
        next[index],
      ];

      return next.map((item, itemIndex) => ({
        ...item,
        sequence_no: itemIndex + 1,
      }));
    });
  }

  function updateItem(
    itemId: string,
    patch: Partial<PlanItem>
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    );
  }

  async function savePlan() {
    if (!selectedVisitorId || !selectedDate) {
      alert("ویزیتور و تاریخ را انتخاب کنید.");
      return;
    }

    setSaving(true);

    try {
      let planId = plan?.id;

      if (!planId) {
        const { data: createdPlan, error: createError } = await supabase
          .from("sales_visit_plans")
          .insert({
            visitor_id: selectedVisitorId,
            plan_date: selectedDate,
            status: "planned",
          })
          .select("id,visitor_id,plan_date,status")
          .single();

        if (createError) throw createError;

        planId = createdPlan.id;
        setPlan(createdPlan as PlanRow);
      } else {
        const { error: updatePlanError } = await supabase
          .from("sales_visit_plans")
          .update({ status: "planned" })
          .eq("id", planId);

        if (updatePlanError) throw updatePlanError;
      }

      const oldItems = items.filter((item) => !item.id.startsWith("temp-"));

      const currentServerIds = new Set(
        items
          .filter((item) => !item.id.startsWith("temp-"))
          .map((item) => item.id)
      );

      const idsToDelete = oldItems.filter(
        (item) => !currentServerIds.has(item.id)
      );

      // Re-read server ids for safe deletion when editing.
      const { data: existingRows, error: existingError } = await supabase
        .from("sales_visit_plan_items")
        .select("id")
        .eq("visit_plan_id", planId);

      if (existingError) throw existingError;

      const idsPresent = new Set(
        items
          .filter((item) => !item.id.startsWith("temp-"))
          .map((item) => item.id)
      );

      const deleteIds = (existingRows || [])
        .map((row) => row.id)
        .filter((id) => !idsPresent.has(id));

      if (deleteIds.length) {
        const { error: deleteError } = await supabase
          .from("sales_visit_plan_items")
          .delete()
          .in("id", deleteIds);

        if (deleteError) throw deleteError;
      }

      const payload = items.map((item, index) => ({
        visit_plan_id: planId,
        customer_id: item.customer_id,
        sequence_no: index + 1,
        planned_time: item.planned_time || null,
        is_target: item.is_target,
        status:
          item.id.startsWith("temp-")
            ? "planned"
            : item.status,
      }));

      if (payload.length) {
        const { error: upsertError } = await supabase
          .from("sales_visit_plan_items")
          .upsert(payload, {
            onConflict: "visit_plan_id,customer_id",
          });

        if (upsertError) throw upsertError;
      }

      await loadPlan();
      alert("برنامه ویزیت با موفقیت ذخیره شد.");
    } catch (error: any) {
      console.error("SAVE VISIT PLAN ERROR:", error);
      alert(`خطا در ذخیره برنامه:\n${error?.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  }

  const selectedVisitor = visitors.find(
    (visitor) => visitor.id === selectedVisitorId
  );

  return (
    <AppShell>
      <PageHeader
        title="برنامه ویزیت روزانه"
        subtitle="Daily Visit Planning"
      />

      <section className="panel">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div className="form-field">
            <label>
              ویزیتور
            </label>
            <select
              className="input"
              value={selectedVisitorId}
              onChange={(event) =>
                setSelectedVisitorId(event.target.value)
              }
              disabled={loading}
            >
              <option value="">انتخاب ویزیتور</option>
              {visitors.map((visitor) => (
                <option key={visitor.id} value={visitor.id}>
                  {visitor.full_name}
                  {visitor.phone ? ` — ${visitor.phone}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>
              تاریخ برنامه
            </label>
            <input
              className="input"
              type="date"
              value={selectedDate}
              onChange={(event) =>
                setSelectedDate(event.target.value)
              }
              disabled={loading}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#475569",
            }}
          >
            <UserRound size={18} />
            <span>
              {selectedVisitor
                ? `${selectedVisitor.full_name} — ${assignedCustomers.length.toLocaleString("fa-IR")} مشتری تخصیص‌یافته`
                : "ویزیتور انتخاب نشده"}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={savePlan}
            disabled={saving || !selectedVisitorId}
          >
            <Save size={16} />
            {saving ? "در حال ذخیره..." : "ذخیره برنامه"}
          </button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.3fr)",
          gap: 18,
          marginTop: 18,
          alignItems: "start",
        }}
      >
        <div className="panel">
          <div
            className="dashboard-panel-title"
            style={{ marginBottom: 14 }}
          >
            <div>
              <span>مشتریان تخصیص‌یافته</span>
              <h2>افزودن به برنامه</h2>
            </div>
            <CalendarDays size={20} />
          </div>

          <input
            className="input"
            value={customerSearch}
            onChange={(event) =>
              setCustomerSearch(event.target.value)
            }
            placeholder="جستجوی مشتری..."
            style={{ marginBottom: 10 }}
          />

          <div
            style={{
              maxHeight: 520,
              overflowY: "auto",
              display: "grid",
              gap: 8,
            }}
          >
            {availableCustomers.length ? (
              availableCustomers.map((customer) => (
                <button
                  type="button"
                  key={customer.id}
                  onClick={() => addCustomer(customer)}
                  style={{
                    width: "100%",
                    textAlign: "right",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    borderRadius: 10,
                    padding: 11,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong>{customer.name}</strong>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {customer.province || "بدون استان"}
                        {customer.phone
                          ? ` · ${customer.phone}`
                          : ""}
                      </div>
                    </div>

                    <Plus size={17} />
                  </div>
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: 22,
                  textAlign: "center",
                  color: "#64748b",
                  border: "1px dashed #cbd5e1",
                  borderRadius: 10,
                }}
              >
                مشتری فعالی برای این ویزیتور پیدا نشد.
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div
            className="dashboard-panel-title"
            style={{ marginBottom: 14 }}
          >
            <div>
              <span>ترتیب بازدید</span>
              <h2>مشتریان هدف امروز</h2>
            </div>
            <span
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                background: "#eef6f1",
                color: "#0f6b43",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              {orderedItems.length.toLocaleString("fa-IR")} مشتری
            </span>
          </div>

          {orderedItems.length ? (
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {orderedItems.map((item, index) => {
                const customer = customers.find(
                  (row) => row.id === item.customer_id
                );

                return (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "34px minmax(0,1fr) auto",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: "#0f6b43",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                        }}
                      >
                        {(index + 1).toLocaleString("fa-IR")}
                      </div>

                      <div>
                        <strong>
                          {customer?.name || "مشتری حذف‌شده"}
                        </strong>
                        <div
                          style={{
                            marginTop: 4,
                            color: "#64748b",
                            fontSize: 12,
                          }}
                        >
                          {customer?.province || "بدون استان"}
                          {customer?.phone
                            ? ` · ${customer.phone}`
                            : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0}
                          title="بالا"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => moveItem(index, 1)}
                          disabled={
                            index === orderedItems.length - 1
                          }
                          title="پایین"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => removeCustomer(item.id)}
                          style={{
                            background: "#fff",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                          }}
                          title="حذف از برنامه"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <div className="form-field">
                        <label>زمان پیشنهادی</label>
                        <input
                          className="input"
                          type="time"
                          value={
                            item.planned_time
                              ? item.planned_time.slice(11, 16)
                              : ""
                          }
                          onChange={(event) => {
                            const time =
                              event.target.value || null;

                            updateItem(item.id, {
                              planned_time: time
                                ? `${selectedDate}T${time}:00`
                                : null,
                            });
                          }}
                        />
                      </div>

                      <div className="form-field">
                        <label>هدف</label>
                        <select
                          className="input"
                          value={
                            item.is_target
                              ? "target"
                              : "non_target"
                          }
                          onChange={(event) =>
                            updateItem(item.id, {
                              is_target:
                                event.target.value ===
                                "target",
                            })
                          }
                        >
                          <option value="target">Target</option>
                          <option value="non_target">
                            Non-Target
                          </option>
                        </select>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginTop: 8,
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      <GripVertical size={15} />
                      <span>
                        وضعیت: {itemStatusLabel[item.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: "#64748b",
                border: "1px dashed #cbd5e1",
                borderRadius: 10,
              }}
            >
              هنوز مشتری‌ای به برنامه امروز اضافه نشده است.
            </div>
          )}

          {plan && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid #e2e8f0",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              وضعیت برنامه: {statusLabel[plan.status]}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
