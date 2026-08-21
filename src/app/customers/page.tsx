"use client";

import { useEffect, useState } from "react";
import { Eye, Trash2, Search, Plus, RotateCcw, Power } from "lucide-react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";


type Customer = {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  province: string | null;
  city: string | null;
  customer_type: string | null;
  address: string | null;
  visitor: string | null;
  responsible: string | null;
  active: boolean | null;
  customer_group_id: string | null;
  branch_count: number;
  is_group_parent: boolean;
};

const emptyForm = {
  name: "",
  owner_name: "",
  phone: "",
  address: "",
  province: "",
  responsible: "",
  visitor: "",
  entry_fee: 0,
  notes: ""
};

export default function CustomersPage() {

  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  type FilterKey = "province" | "city" | "customer_type" | "name" | "visitor" | "status";

  const [search, setSearch] = useState("");

  const [filterSelections, setFilterSelections] = useState<Record<FilterKey, string[]>>({
    province: [],
    city: [],
    customer_type: [],
    name: [],
    visitor: [],
    status: [],
  });

  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [sortKey, setSortKey] = useState<FilterKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState(emptyForm);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    const [
      { data: customerRows, error: customerError },
      { data: groupRows, error: groupError },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select(`
          id,
          name,
          owner_name,
          phone,
          province,
          city,
          customer_type,
          address,
          visitor,
          responsible,
          active,
          customer_group_id
        `)
        .order("name"),

      supabase
        .from("customer_groups")
        .select("id, name, primary_customer_id"),
    ]);

    if (customerError) {
      console.error(customerError);
      alert("خطا در دریافت مشتریان:\n" + customerError.message);
      setLoading(false);
      return;
    }

    if (groupError) {
      console.error(groupError);
      alert("خطا در دریافت مجموعه‌های مشتریان:\n" + groupError.message);
      setLoading(false);
      return;
    }

    const groups = (groupRows || []) as Array<{
      id: string;
      name: string;
      primary_customer_id: string;
    }>;

    const groupMap = new Map(
      groups.map((group) => [group.id, group])
    );

    // صفحه اول فقط مشتری مادر / مشتری مستقل را نشان می‌دهد.
    // شعبه‌ها مستقیماً در پرونده مجموعه دیده می‌شوند.
    const visibleCustomers = (customerRows || [])
      .filter((customer: any) => {
        if (!customer.customer_group_id) return true;

        const group = groupMap.get(customer.customer_group_id);

        return group?.primary_customer_id === customer.id;
      })
      .map((customer: any) => {
        const group = customer.customer_group_id
          ? groupMap.get(customer.customer_group_id)
          : undefined;

        const branchCount = customer.customer_group_id
          ? (customerRows || []).filter(
              (branch: any) =>
                branch.customer_group_id === customer.customer_group_id &&
                branch.id !== customer.id
            ).length
          : 0;

        return {
          ...customer,
          name: group?.name || customer.name,
          branch_count: branchCount,
          is_group_parent: Boolean(group),
        } as Customer;
      });

    setCustomers(visibleCustomers);
    setLoading(false);
  }

  async function toggleCustomerActive(id: string, currentStatus: boolean | null) {
    const nextStatus = !currentStatus;

    const ok = confirm(
      nextStatus
        ? "آیا می‌خواهید این مشتری را فعال کنید؟"
        : "آیا می‌خواهید این مشتری را غیرفعال کنید؟"
    );

    if (!ok) return;

    const { error } = await supabase
      .from("customers")
      .update({ active: nextStatus })
      .eq("id", id);

    if (error) {
      alert("خطا در تغییر وضعیت مشتری:\n" + error.message);
      return;
    }

    setCustomers((current) =>
      current.map((customer) =>
        customer.id === id
          ? { ...customer, active: nextStatus }
          : customer
      )
    );
  }

  async function deleteCustomer(id: string) {

    if (!id) {
      alert("شناسه مشتری وجود ندارد");
      return;
    }

    const customer = customers.find(c => c.id === id);

    const ok = confirm(
      `آیا از حذف مشتری "${customer?.name || ""}" مطمئن هستید؟\\n\\nتمام اطلاعات وابسته این مشتری نیز بررسی خواهد شد.`
    );

    if (!ok) return;


    try {

      // حذف اطلاعات وابسته قبل از حذف مشتری
      // به دلیل وجود Foreign Key در جدول orders

      const { error: ordersError } = await supabase
        .from("orders")
        .delete()
        .eq("customer_id", id);

      if (ordersError) {
        throw ordersError;
      }


      const { error: discountError } = await supabase
        .from("customer_group_discounts")
        .delete()
        .eq("customer_id", id);

      if (discountError) {
        throw discountError;
      }


      const { error: mediaError } = await supabase
        .from("customer_media")
        .delete()
        .eq("customer_id", id);

      if (mediaError) {
        throw mediaError;
      }


      const { error: customerError } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (customerError) {
        throw customerError;
      }


      setCustomers(prev =>
        prev.filter(c => c.id !== id)
      );


      alert("مشتری با موفقیت حذف شد");


    } catch(error:any) {

      console.error("DELETE CUSTOMER ERROR:", error);

      alert(
        "خطا در حذف مشتری:\n" +
        error.message
      );
    }
  }

  function openCustomer(id: string) {
    if (!id) {
      alert("شناسه مشتری وجود ندارد");
      return;
    }
    router.push(`/customers/${id}`);
  }

  function openCreateModal() {
    setNewForm(emptyForm);
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (saving) return;
    setShowCreate(false);
  }

  async function createCustomer() {

    if (!newForm.name.trim()) {
      alert("نام فروشگاه / مشتری را وارد کنید");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: newForm.name,
        owner_name: newForm.owner_name || null,
        phone: newForm.phone || null,
        address: newForm.address || null,
        province: newForm.province || null,
        responsible: newForm.responsible || null,
        visitor: newForm.visitor || null,
        entry_fee: Number(newForm.entry_fee) || 0,
        notes: newForm.notes || null,
        active: true
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert("خطا در ثبت مشتری:\n" + error.message);
      return;
    }

    alert("مشتری جدید ثبت شد");

    setShowCreate(false);
    setNewForm(emptyForm);

    await loadCustomers();

    // انتقال مستقیم به صفحه جزئیات مشتری تازه‌ساخته‌شده
    if (data?.id) {
      openCustomer(data.id);
    }
  }

  const filterLabels: Record<FilterKey, string> = {
    name: "نام شعبه",
    customer_type: "نوع مشتری",
    province: "استان",
    city: "شهر",
    visitor: "نام ویزیتور",
    status: "وضعیت",
  };

  function getFilterValue(customer: Customer, key: FilterKey) {
    if (key === "status") return customer.active ? "فعال" : "غیرفعال";
    if (key === "province") return customer.province || "";
    if (key === "city") return customer.city || "";
    if (key === "customer_type") return customer.customer_type || "";
    if (key === "name") return customer.name || "";
    return customer.visitor || "";
  }

  function getUniqueFilterValues(key: FilterKey) {
    return Array.from(
      new Set(
        customers
          .map(customer => getFilterValue(customer, key))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "fa"));
  }

  function toggleFilterValue(key: FilterKey, value: string) {
    setFilterSelections(current => {
      const selected = current[key];
      const next = selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value];

      return {
        ...current,
        [key]: next,
      };
    });
  }

  function clearAllFilters() {
    setFilterSelections({
      province: [],
      city: [],
      customer_type: [],
      name: [],
      visitor: [],
      status: [],
    });
    setOpenFilter(null);
    setFilterSearch("");
    setSortKey(null);
  }

  function sortByFilter(key: FilterKey, direction: "asc" | "desc") {
    setSortKey(key);
    setSortDirection(direction);
  }

  const filteredCustomers = [...customers]
    .filter(customer => {
      const globalText = [
        customer.name,
        customer.owner_name,
        customer.phone,
        customer.province,
        customer.city,
        customer.customer_type,
        customer.visitor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!globalText.includes(search.toLowerCase())) {
        return false;
      }

      return (Object.keys(filterSelections) as FilterKey[]).every(key => {
        const selected = filterSelections[key];
        if (selected.length === 0) return true;
        return selected.includes(getFilterValue(customer, key));
      });
    })
    .sort((a, b) => {
      if (!sortKey) return 0;

      const av = getFilterValue(a, sortKey);
      const bv = getFilterValue(b, sortKey);

      const result = av.localeCompare(bv, "fa");
      return sortDirection === "asc" ? result : -result;
    });

  return (
    <AppShell>

      <PageHeader
        title="مشتریان"
        subtitle="مدیریت اطلاعات مشتریان"
      />

      {/* دکمه ثبت مشتری در ردیف بالای نوار فیلتر */}
      <div
        dir="rtl"
        style={{
          width: "97%",
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: -43 ,
          marginTop : -80 ,
         
         
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => router.push("/customers/new")}
          style={{
            height: 42,
            minWidth: 126,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 900,
            borderRadius: 8,
          }}
        >
          <Plus size={15} />
          مشتری جدید
        </button>
      </div>

            {/* نوار فیلتر مستقل از جدول */}
      <div
        dir="rtl"
        style={{
          width: "70%",
          marginBottom: 50,
          display: "flex",
          justifyContent: "center",
          marginRight : 200 , 
          marginTop : -20 ,

        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "stretch",
            direction: "rtl",
            background: "#f2f4f3",
            border: "1px solid #cfd6d2",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
            overflow: "visible",
          }}
        >
          {(Object.keys(filterLabels) as FilterKey[]).map(key => {
            const isOpen = openFilter === key;
            const selected = filterSelections[key];

            const values = getUniqueFilterValues(key).filter(value =>
              value.toLowerCase().includes(filterSearch.toLowerCase())
            );

            return (
              <div
                key={key}
                style={{
                  position: "relative",
                  flex: "1 1 0",
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenFilter(current => current === key ? null : key);
                    setFilterSearch("");
                  }}
                  style={{
                    width: "100%",
                    height: 42,
                    border: "0",
                    borderLeft: "1px solid #cfd6d2",
                    borderRadius: 0,
                    background: selected.length ? "#149b5c" : "#f2f4f3",
                    color: selected.length ? "#fff" : "#1f2937",
                    fontWeight: selected.length ? 800 : 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "0 10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selected.length
                      ? `${filterLabels[key]} (${selected.length})`
                      : filterLabels[key]}
                  </span>

                  <span style={{ fontSize: 10 }}>
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 4px)",
                      width: 300,
                      zIndex: 10000,
                      background: "#fff",
                      border: "1px solid #cfd6d2",
                      borderRadius: 8,
                      boxShadow: "0 14px 30px rgba(15,23,42,.14)",
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => sortByFilter(key, "asc")}
                      >
                        مرتب‌سازی صعودی
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => sortByFilter(key, "desc")}
                      >
                        مرتب‌سازی نزولی
                      </button>
                    </div>

                    <input
                      className="input"
                      placeholder={`جستجو در ${filterLabels[key]}...`}
                      value={filterSearch}
                      onChange={e => setFilterSearch(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      <span>انتخاب چند مقدار</span>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#0f6b43",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                          onClick={() =>
                            setFilterSelections(current => ({
                              ...current,
                              [key]: [...getUniqueFilterValues(key)],
                            }))
                          }
                        >
                          انتخاب همه
                        </button>

                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#dc2626",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                          onClick={() =>
                            setFilterSelections(current => ({
                              ...current,
                              [key]: [],
                            }))
                          }
                        >
                          پاک‌کردن
                        </button>
                      </div>
                    </div>

                    <div style={{ maxHeight: 240, overflowY: "auto" }}>
                      {values.map(value => (
                        <label
                          key={value}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 4px",
                            cursor: "pointer",
                            borderRadius: 6,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(value)}
                            onChange={() => toggleFilterValue(key, value)}
                          />
                          <span>{value}</span>
                        </label>
                      ))}

                      {values.length === 0 && (
                        <div
                          style={{
                            padding: 12,
                            textAlign: "center",
                            color: "#94a3b8",
                          }}
                        >
                          مقداری پیدا نشد
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={clearAllFilters}
            title="حذف همه فیلترها"
            style={{
              flex: "0 0 42px",
              height: 42,
              border: "0",
              background: "#dc2626",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 0,
            }}
          >
            <RotateCcw size={17} />
          </button>


        </div>
      </div>

      <div
  className="panel"
  style={{
    width: "96%",
    margin: "0 auto",
  }}
>
        <div
          className="table-wrap"
          style={{
            width: "104%",
            padding: "0px  0px",
            boxSizing: "border-box",
          }}
        >

          {
            loading ?
              <div style={{ padding: 40, textAlign: "center"    }}>
                در حال دریافت اطلاعات...
              </div>
              :
              <table
                style={{
                  width: "96%",
                  tableLayout: "fixed",
                }}
              >

                <thead style={{ fontWeight: 900, color: "#000000" }}>
                  <tr>
                    <th style={{ textAlign: "center" }}>نام شعبه</th>
                    <th style={{ textAlign: "center" }}>نوع مشتری</th>
                    <th style={{ textAlign: "center" }}>تعداد شعبه</th>
                    <th style={{ textAlign: "center" }}>استان</th>
                    <th style={{ textAlign: "center" }}>شهر</th>
                    <th style={{ textAlign: "center" }}>ویزیتور</th>
                    <th style={{ textAlign: "center" }}>وضعیت</th>
                    <th
                      style={{
                        textAlign: "center",
                        width: "180px",
                      }}
                    >
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {
                    filteredCustomers.map(customer => (

                      <tr
                        key={customer.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => openCustomer(customer.id)}
                      >

                        <td style={{ padding: "12px 18px", textAlign: "center" }}>
                          {customer.name}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "center" }}>{customer.customer_type || "-"}</td>
                        <td style={{ padding: "12px 18px", textAlign: "center" }}>
                          {customer.branch_count > 0
                            ? customer.branch_count.toLocaleString("fa-IR")
                            : "-"}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "center" }}>{customer.province || "-"}</td>
                        <td style={{ padding: "12px 18px", textAlign: "center" }}>{customer.city || "-"}</td>
                        <td style={{ padding: "12px 18px", textAlign: "center" }}>{customer.visitor || "-"}</td>

                        <td style={{ padding: "12px 18px", textAlign: "center" }}>
                          <span
                            className={customer.active ? "badge success" : "badge danger"}
                          >
                            {customer.active ? "فعال" : "غیرفعال"}
                          </span>
                        </td>

                        <td style={{ padding: "12px 18px", textAlign: "center" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >

                            <button
                              className="btn btn-secondary btn-small"
                              title="مشاهده"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCustomer(customer.id);
                              }}
                              style={{ width: 34, height: 34, padding: 0, justifyContent: "center" }}
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              className={customer.active ? "btn btn-secondary btn-small" : "btn btn-primary btn-small"}
                              title={customer.active ? "غیرفعال کردن" : "فعال کردن"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCustomerActive(customer.id, customer.active);
                              }}
                              style={{ width: 34, height: 34, padding: 0, justifyContent: "center" }}
                            >
                              <Power size={17} />
                            </button>

                            <button
                              className="btn btn-danger btn-small"
                              title="حذف"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomer(customer.id);
                              }}
                              style={{ width: 34, height: 34, padding: 0, justifyContent: "center" }}
                            >
                              <Trash2 size={16} />
                            </button>

                          </div>
                        </td>

                      </tr>

                    ))
                  }

                  {
                    filteredCustomers.length === 0 &&
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 30 }}>
                        مشتری‌ای پیدا نشد
                      </td>
                    </tr>
                  }

                </tbody>

              </table>
          }

        </div>

      </div>

    </AppShell>
  );
}