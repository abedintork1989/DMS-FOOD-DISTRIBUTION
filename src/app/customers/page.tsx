"use client";

import { useEffect, useState } from "react";
import { Eye, Trash2, Search, Plus } from "lucide-react";
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
  const [search, setSearch] = useState("");

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

  const filteredCustomers = customers.filter(c => {
    const text = [c.name, c.owner_name, c.phone, c.province, c.visitor]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <AppShell>

      <PageHeader
        title="مشتریان"
        subtitle="مدیریت اطلاعات مشتریان"
      />

      <div className="panel">

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap"
          }}
        >

          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>

            <Search
              size={18}
              style={{
                position: "absolute",
                right: 12,
                top: 12,
                color: "#94a3b8"
              }}
            />

            <input
              className="input"
              style={{ paddingRight: 40 }}
              placeholder="جستجوی مشتری..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

          </div>

          <button
            className="btn btn-primary"
            onClick={() => router.push("/customers/new")}
          >
            <Plus size={16} />
            مشتری جدید
          </button>

        </div>

        <div className="table-wrap">

          {
            loading ?
              <div style={{ padding: 40, textAlign: "center" }}>
                در حال دریافت اطلاعات...
              </div>
              :
              <table>

                <thead>
                  <tr>
                    <th>نام مشتری</th>
                    <th>تعداد شعبه</th>
                    <th>مالک</th>
                    <th>تلفن</th>
                    <th>استان</th>
                    <th>ویزیتور</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
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

                        <td>
                          <strong>{customer.name}</strong>
                          {customer.is_group_parent && (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: "#64748b",
                              }}
                            >
                              مجموعه مشتری
                            </div>
                          )}
                        </td>
                        <td>
                          {customer.branch_count > 0
                            ? customer.branch_count.toLocaleString("fa-IR")
                            : "-"}
                        </td>
                        <td>{customer.owner_name || "-"}</td>
                        <td>{customer.phone || "-"}</td>
                        <td>{customer.province || "-"}</td>
                        <td>{customer.visitor || "-"}</td>

                        <td>
                          <span
                            className={customer.active ? "badge success" : "badge danger"}
                          >
                            {customer.active ? "فعال" : "غیرفعال"}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: "flex", gap: 8 }}>

                            <button
                              className="btn btn-secondary btn-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCustomer(customer.id);
                              }}
                            >
                              <Eye size={15} />
                              مشاهده
                            </button>

                            <button
                              className="btn btn-danger btn-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomer(customer.id);
                              }}
                            >
                              <Trash2 size={15} />
                              حذف
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