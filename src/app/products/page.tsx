"use client";

import { useEffect, useRef, useState } from "react";

import {
  Plus,
  Trash2,
  X,
  PackagePlus,
  Image as ImageIcon,
  Upload,
  Pencil,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { supabase } from "../../lib/supabase";

import * as XLSX from "xlsx";

/* =========================================================
   Types
========================================================= */

type Product = {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  unit?: string;
  quantity_per_carton?: number;
  consumer_price?: number;
  inventory?: number;
  image_url?: string | null;
};

type ProductForm = {
  name: string;
  category: string;
  barcode: string;
  unit: string;
  quantity_per_carton: string;
  consumer_price: string;
  inventory: string;
};

type BulkResult = {
  row: number;
  name: string;
  error: string;
};

/* =========================================================
   Empty Form
========================================================= */

const emptyForm: ProductForm = {
  name: "",
  category: "",
  barcode: "",
  unit: "",
  quantity_per_carton: "1",
  consumer_price: "",
  inventory: "",
};

/* =========================================================
   تبدیل اعداد فارسی / عربی به انگلیسی
========================================================= */

function normalizeNumber(value: string) {
  return String(value || "")
    .replace(/[۰-۹]/g, (char) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(char))
    )
    .replace(/[٠-٩]/g, (char) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(char))
    )
    .replace(/,/g, "")
    .replace(/٬/g, "")
    .replace(/\s/g, "");
}

/* =========================================================
   فرمت عدد هنگام تایپ
========================================================= */

function formatNumberInput(value: string) {
  const normalized = normalizeNumber(value);

  if (!normalized) {
    return "";
  }

  const numeric = normalized.replace(/[^\d]/g, "");

  if (!numeric) {
    return "";
  }

  return new Intl.NumberFormat("fa-IR").format(
    Number(numeric)
  );
}

/* =========================================================
   تبدیل مقدار عددی
========================================================= */

function toNumber(value: any) {
  const normalized = normalizeNumber(
    String(value ?? "")
  );

  if (!normalized) {
    return 0;
  }

  const number = Number(
    normalized.replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(number)
    ? number
    : 0;
}

/* =========================================================
   نمایش پول
========================================================= */

function money(value?: number) {
  return (
    new Intl.NumberFormat("fa-IR").format(
      Number(value || 0)
    ) + " ریال"
  );
}

/* =========================================================
   نمایش عدد فارسی
========================================================= */

function numberFa(value?: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Number(value || 0)
  );
}

/* =========================================================
   Products Page
========================================================= */

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  /* =======================================================
     فیلتر و جستجوی ستونی
  ======================================================= */

  type FilterKey =
    | "name"
    | "category"
    | "barcode"
    | "inventory";

  const [filterSelections, setFilterSelections] = useState<Record<FilterKey, string[]>>({
    name: [],
    category: [],
    barcode: [],
    inventory: [],
  });

  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [sortKey, setSortKey] = useState<FilterKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  /* =======================================================
     Modal ثبت / ویرایش
  ======================================================= */

  const [modal, setModal] =
    useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [form, setForm] =
    useState<ProductForm>(emptyForm);

  /* =======================================================
     تصویر
  ======================================================= */

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState("");

  const [uploading, setUploading] =
    useState(false);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

    
  /* =======================================================
     Modal ورود گروهی
  ======================================================= */

  const [bulkModal, setBulkModal] =
    useState(false);

  const [bulkFile, setBulkFile] =
    useState<File | null>(null);

  const [bulkUploading, setBulkUploading] =
    useState(false);

  const [bulkSuccessCount, setBulkSuccessCount] =
    useState(0);

  const [bulkErrors, setBulkErrors] =
    useState<BulkResult[]>([]);

  const bulkFileRef =
    useRef<HTMLInputElement | null>(null);

  /* =======================================================
     Load Products
  ======================================================= */

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      console.log(error);
      alert(error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  }

  /* =======================================================
     باز کردن فرم کالای جدید
  ======================================================= */

  function openNewProduct() {
    setEditingProduct(null);

    setForm({
      ...emptyForm,
    });

    setImageFile(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setModal(true);
  }

  /* =======================================================
     باز کردن فرم ویرایش
  ======================================================= */

  function openEditProduct(product: Product) {
    setEditingProduct(product);

    setForm({
      name: product.name || "",
      category: product.category || "",
      barcode: product.barcode || "",
      unit: product.unit || "",

      quantity_per_carton:
        formatNumberInput(
          String(
            product.quantity_per_carton ?? 1
          )
        ),

      consumer_price:
        formatNumberInput(
          String(
            product.consumer_price ?? 0
          )
        ),

      inventory:
        formatNumberInput(
          String(
            product.inventory ?? 0
          )
        ),
    });

    setImageFile(null);

    setImagePreview(
      product.image_url || ""
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setModal(true);
  }

  /* =======================================================
     بستن Modal
  ======================================================= */

  function closeModal() {
    if (uploading) {
      return;
    }

    setModal(false);

    setEditingProduct(null);

    setForm({
      ...emptyForm,
    });

    setImageFile(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* =======================================================
     انتخاب تصویر
  ======================================================= */

  function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert(
        "لطفاً یک فایل تصویری انتخاب کنید."
      );
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      alert(
        "حجم تصویر نباید بیشتر از ۵ مگابایت باشد."
      );
      return;
    }

    setImageFile(file);

    const previewUrl =
      URL.createObjectURL(file);

    setImagePreview(previewUrl);
  }

  /* =======================================================
     حذف تصویر انتخابی
  ======================================================= */

  function removeSelectedImage() {
    setImageFile(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* =======================================================
     تغییر عدد
  ======================================================= */

  function handleNumberChange(
    field:
      | "quantity_per_carton"
      | "consumer_price"
      | "inventory",
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [field]:
        formatNumberInput(value),
    }));
  }

  /* =======================================================
     آپلود تصویر
  ======================================================= */

  async function uploadProductImage() {
    if (!imageFile) {
      return null;
    }

    const extension =
      imageFile.name
        .split(".")
        .pop() || "jpg";

    const fileName =
      `${crypto.randomUUID()}.${extension}`;

    const {
      error,
    } = await supabase.storage
      .from("product-images")
      .upload(
        fileName,
        imageFile,
        {
          cacheControl: "3600",
          upsert: false,
        }
      );

    if (error) {
      throw error;
    }

    const {
      data,
    } =
      supabase.storage
        .from("product-images")
        .getPublicUrl(
          fileName
        );

    return data.publicUrl;
  }

  /* =======================================================
     ذخیره کالا
  ======================================================= */

  async function saveProduct() {
    if (!form.name.trim()) {
      alert(
        "نام کالا را وارد کنید."
      );
      return;
    }

    if (uploading) {
      return;
    }

    try {
      setUploading(true);

      const quantityPerCarton =
        toNumber(
          form.quantity_per_carton
        );

      const consumerPrice =
        toNumber(
          form.consumer_price
        );

      const inventory =
        toNumber(
          form.inventory
        );

      let imageUrl =
        editingProduct?.image_url ||
        null;

      /* -----------------------------------------------
         اگر تصویر جدید انتخاب شده
      ------------------------------------------------ */

      if (imageFile) {
        imageUrl =
          await uploadProductImage();
      }

      /* =================================================
         ویرایش
      ================================================= */

      if (editingProduct) {
        const {
          error,
        } = await supabase
          .from("products")
          .update({
            name:
              form.name.trim(),

            category:
              form.category.trim(),

            barcode:
              form.barcode.trim(),

            unit:
              form.unit.trim(),

            quantity_per_carton:
              quantityPerCarton,

            consumer_price:
              consumerPrice,

            inventory:
              inventory,

            image_url:
              imageUrl,
          })
          .eq(
            "id",
            editingProduct.id
          );

        if (error) {
          alert(error.message);
          return;
        }

        alert(
          "اطلاعات کالا با موفقیت ویرایش شد."
        );

      } else {
        /* =================================================
           ثبت کالای جدید
        ================================================= */

        const {
          error,
        } = await supabase
          .from("products")
          .insert({
            name:
              form.name.trim(),

            category:
              form.category.trim(),

            barcode:
              form.barcode.trim(),

            unit:
              form.unit.trim(),

            quantity_per_carton:
              quantityPerCarton,

            consumer_price:
              consumerPrice,

            inventory:
              inventory,

            image_url:
              imageUrl,
          });

        if (error) {
          alert(error.message);
          return;
        }

        alert(
          "کالا با موفقیت ثبت شد."
        );
      }

      closeModal();

      await loadProducts();

    } catch (error: any) {
      console.log(error);

      alert(
        error?.message ||
        "خطایی هنگام ذخیره کالا رخ داد."
      );

    } finally {
      setUploading(false);
    }
  }

  /* =======================================================
     حذف کالا
  ======================================================= */

  async function deleteProduct(
    id: string
  ) {
    const ok =
      confirm(
        "آیا از حذف این کالا مطمئن هستید؟"
      );

    if (!ok) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadProducts();
  }

  /* =======================================================
     دانلود نمونه Excel
  ======================================================= */

  function downloadExcelTemplate() {
    const templateData = [
      {
        "نام کالا": "نوشابه کوکاکولا",
        "گروه کالا": "نوشیدنی",
        "بارکد": "6261234567890",
        "واحد": "عدد",
        "تعداد در کارتن": 12,
        "قیمت مصرف کننده": 1500000,
        "موجودی": 100,
      },

      {
        "نام کالا": "چیپس نمکی",
        "گروه کالا": "تنقلات",
        "بارکد": "6269876543210",
        "واحد": "عدد",
        "تعداد در کارتن": 24,
        "قیمت مصرف کننده": 850000,
        "موجودی": 200,
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        templateData
      );

    worksheet["!cols"] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "کالاها"
    );

    XLSX.writeFile(
      workbook,
      "نمونه-ورود-گروهی-کالاها.xlsx"
    );
  }



function exportProductsExcel(){

  const excelData = products.map((p,index)=>({

    "ردیف": index + 1,

    "نام کالا": p.name,

    "گروه کالا": p.category,

    "بارکد": p.barcode || "",

    "واحد": p.unit || "",

    "تعداد در کارتن":
      p.quantity_per_carton || 0,

    "قیمت مصرف کننده":
      p.consumer_price || 0,

    "موجودی":
      p.inventory || 0

  }));



  const worksheet =
    XLSX.utils.json_to_sheet(
      excelData
    );



  worksheet["!cols"]=[

    {wch:8},
    {wch:30},
    {wch:20},
    {wch:20},
    {wch:15},
    {wch:18},
    {wch:20},
    {wch:15}

  ];



  const workbook =
    XLSX.utils.book_new();



  XLSX.utils.book_append_sheet(

    workbook,

    worksheet,

    "لیست کالاها"

  );



  XLSX.writeFile(

    workbook,

    "لیست-کالاها.xlsx"

  );


}




  /* =======================================================
     انتخاب فایل Excel
  ======================================================= */

  function handleBulkFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase();

    if (
      extension !== "xlsx" &&
      extension !== "xls"
    ) {
      alert(
        "فقط فایل Excel با فرمت XLSX یا XLS قابل قبول است."
      );

      e.target.value = "";

      return;
    }

    setBulkFile(file);

    setBulkSuccessCount(0);
    setBulkErrors([]);
  }

  /* =======================================================
     بستن Bulk Modal
  ======================================================= */

  function closeBulkModal() {
    if (bulkUploading) {
      return;
    }

    setBulkModal(false);

    setBulkFile(null);

    setBulkSuccessCount(0);

    setBulkErrors([]);

    if (bulkFileRef.current) {
      bulkFileRef.current.value = "";
    }
  }

  /* =======================================================
     ورود گروهی Excel
  ======================================================= */

  async function importExcel() {
    if (!bulkFile) {
      alert(
        "ابتدا فایل Excel را انتخاب کنید."
      );
      return;
    }

    if (bulkUploading) {
      return;
    }

    try {
      setBulkUploading(true);

      setBulkErrors([]);

      setBulkSuccessCount(0);

      /* -----------------------------------------------
         خواندن فایل
      ------------------------------------------------ */

      const arrayBuffer =
        await bulkFile.arrayBuffer();

      const workbook =
        XLSX.read(
          arrayBuffer,
          {
            type: "array",
          }
        );

      const sheetName =
        workbook.SheetNames[0];

      if (!sheetName) {
        alert(
          "فایل Excel فاقد Sheet است."
        );
        return;
      }

      const worksheet =
        workbook.Sheets[
          sheetName
        ];

      const rows =
        XLSX.utils.sheet_to_json<any>(
          worksheet,
          {
            defval: "",
          }
        );

      if (!rows.length) {
        alert(
          "فایل Excel خالی است."
        );
        return;
      }

      /* -----------------------------------------------
         تبدیل ردیف‌ها
      ------------------------------------------------ */

      const validProducts: any[] = [];

      const errors: BulkResult[] = [];

      rows.forEach(
        (row, index) => {
          const excelRow =
            index + 2;

          const name =
            String(
              row["نام کالا"] ??
              row["name"] ??
              ""
            ).trim();

          if (!name) {
            errors.push({
              row: excelRow,
              name: "-",
              error:
                "نام کالا وارد نشده است.",
            });

            return;
          }

          const category =
            String(
              row["گروه کالا"] ??
              row["category"] ??
              ""
            ).trim();

          const barcode =
            String(
              row["بارکد"] ??
              row["barcode"] ??
              ""
            ).trim();

          const unit =
            String(
              row["واحد"] ??
              row["unit"] ??
              ""
            ).trim();

          const quantityPerCarton =
            toNumber(
              row["تعداد در کارتن"] ??
              row["quantity_per_carton"] ??
              1
            );

          const consumerPrice =
            toNumber(
              row["قیمت مصرف کننده"] ??
              row["قیمت مصرف‌کننده"] ??
              row["consumer_price"] ??
              0
            );

          const inventory =
            toNumber(
              row["موجودی"] ??
              row["inventory"] ??
              0
            );

          validProducts.push({
            name,
            category,
            barcode,
            unit,

            quantity_per_carton:
              quantityPerCarton,

            consumer_price:
              consumerPrice,

            inventory,

            image_url:
              null,
          });
        }
      );

      /* -----------------------------------------------
         اگر هیچ رکورد معتبری وجود ندارد
      ------------------------------------------------ */

      if (!validProducts.length) {
        setBulkErrors(errors);

        alert(
          "هیچ ردیف معتبری برای ثبت پیدا نشد."
        );

        return;
      }

      /* -----------------------------------------------
         ثبت گروهی
      ------------------------------------------------ */

      const {
        error,
      } = await supabase
        .from("products")
        .insert(
          validProducts
        );

      if (error) {
        console.log(error);

        alert(
          error.message
        );

        return;
      }

      /* -----------------------------------------------
         نتیجه
      ------------------------------------------------ */

      setBulkSuccessCount(
        validProducts.length
      );

      setBulkErrors(
        errors
      );

      await loadProducts();

      if (!errors.length) {
        alert(
          `${new Intl.NumberFormat(
            "fa-IR"
          ).format(
            validProducts.length
          )} کالا با موفقیت وارد شد.`
        );
      }

    } catch (error: any) {
      console.log(error);

      alert(
        error?.message ||
        "در خواندن فایل Excel خطایی رخ داد."
      );

    } finally {
      setBulkUploading(false);
    }
  }

  /* =======================================================
     فیلتر و مرتب‌سازی ستونی
  ======================================================= */

  const filterLabels: Record<FilterKey, string> = {
    name: "نام کالا",
    category: "گروه کالا",
    barcode: "بارکد",
    inventory: "موجودی",
  };

  function getFilterValue(product: Product, key: FilterKey) {
    if (key === "name") return product.name || "";
    if (key === "category") return product.category || "";
    if (key === "barcode") return product.barcode || "";
    return numberFa(product.inventory);
  }

  function getUniqueFilterValues(key: FilterKey) {
    return Array.from(
      new Set(
        products
          .map((product) => getFilterValue(product, key))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "fa"));
  }

  function toggleFilterValue(key: FilterKey, value: string) {
    setFilterSelections((current) => {
      const selected = current[key];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];

      return {
        ...current,
        [key]: next,
      };
    });
  }

  function clearAllFilters() {
    setFilterSelections({
      name: [],
      category: [],
      barcode: [],
      inventory: [],
    });
    setOpenFilter(null);
    setFilterSearch("");
    setSortKey(null);
  }

  function sortByFilter(key: FilterKey, direction: "asc" | "desc") {
    setSortKey(key);
    setSortDirection(direction);
  }

  const filteredProducts = [...products]
    .filter((product) =>
      (Object.keys(filterSelections) as FilterKey[]).every((key) => {
        const selected = filterSelections[key];
        if (selected.length === 0) return true;
        return selected.includes(getFilterValue(product, key));
      })
    )
    .sort((a, b) => {
      if (!sortKey) return 0;

      const av = getFilterValue(a, sortKey);
      const bv = getFilterValue(b, sortKey);

      const result = av.localeCompare(bv, "fa", { numeric: true });
      return sortDirection === "asc" ? result : -result;
    });

  /* =======================================================
     Render
  ======================================================= */

  return (
    <AppShell>

      {/* =====================================================
          Header
      ===================================================== */}

      <PageHeader
        title="کالاها"
        subtitle="مدیریت کالاهای شرکت پخش"
        action={
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
{/* خروجی اکسل */}

<button

className="btn btn-success btn-small"

onClick={exportProductsExcel}

title="خروجی اکسل کالاها"

style={{ width: 38, height: 38, padding: 0, justifyContent: "center" }}

>

<Download size={17}/>

</button>
            {/* ورود گروهی */}

            <button
              className="btn btn-secondary btn-small"
              onClick={() =>
                setBulkModal(true)
              }
              title="ورود گروهی با اکسل"
              style={{ width: 38, height: 38, padding: 0, justifyContent: "center" }}
            >
              <FileSpreadsheet
                size={17}
              />
            </button>

            {/* کالای جدید */}

            <button
              className="btn btn-primary"
              onClick={
                openNewProduct
              }
            >
              <Plus
                size={17}
              />

              کالای جدید
            </button>

          </div>
        }
      />

      {/* نوار فیلتر مستقل از جدول */}
      <div
        dir="rtl"
        style={{
          width: "100%",
          marginBottom: 12,
          marginTop: -18,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "50%",
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
          {(Object.keys(filterLabels) as FilterKey[]).map((key) => {
            const isOpen = openFilter === key;
            const selected = filterSelections[key];

            const values = getUniqueFilterValues(key).filter((value) =>
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
                    setOpenFilter((current) => (current === key ? null : key));
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
                      onChange={(e) => setFilterSearch(e.target.value)}
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
                            setFilterSelections((current) => ({
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
                            setFilterSelections((current) => ({
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
                      {values.map((value) => (
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

      {/* =====================================================
          Table
      ===================================================== */}

      <div className="panel">

        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom:
              6,
          }}
        >

          <div>

            <h2
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              لیست کالاها
            </h2>

            <p
              style={{
                margin:
                  "2px 0 0",
                color:
                  "#64748b",
                fontSize: 11,
              }}
            >
              {numberFa(
                products.length
              )}{" "}
              کالا ثبت شده است
            </p>

          </div>

        </div>

        {loading ? (

          <div className="empty">
            در حال دریافت اطلاعات کالاها...
          </div>

        ) : products.length === 0 ? (

          <div className="empty">
            هنوز کالایی ثبت نشده است.
          </div>

        ) : (

          <div className="table-wrap">

            <table>

              <thead>

                <tr>

                  <th>
                    تصویر
                  </th>

                  <th>
                    نام کالا
                  </th>

                  <th>
                    گروه کالا
                  </th>

                  <th>
                    بارکد
                  </th>

                  <th>
                    واحد
                  </th>

                  <th>
                    تعداد در کارتن
                  </th>

                  <th>
                    قیمت مصرف‌کننده
                  </th>

                  <th>
                    موجودی
                  </th>

                  <th>
                    عملیات
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredProducts.map(
                  (product) => (

                    <tr
                      key={
                        product.id
                      }
                    >

                      <td>

                        {product.image_url ? (

                          <img
                            src={
                              product.image_url
                            }
                            alt={
                              product.name
                            }
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 10,
                              objectFit:
                                "cover",
                              border:
                                "1px solid #e2e8f0",
                            }}
                          />

                        ) : (

                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 10,
                              background:
                                "#f1f5f9",
                              display:
                                "grid",
                              placeItems:
                                "center",
                              color:
                                "#94a3b8",
                            }}
                          >
                            <ImageIcon
                              size={19}
                            />
                          </div>

                        )}

                      </td>

                      <td>
                        {product.name ||
                          "-"}
                      </td>

                      <td>
                        {product.category ||
                          "-"}
                      </td>

                      <td>
                        {product.barcode ||
                          "-"}
                      </td>

                      <td>
                        {product.unit ||
                          "-"}
                      </td>

                      <td>
                        {numberFa(
                          product.quantity_per_carton
                        )}
                      </td>

                      <td>
                        {money(
                          product.consumer_price
                        )}
                      </td>

                      <td>
                        {numberFa(
                          product.inventory
                        )}
                      </td>

                      <td>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 6,
                          }}
                        >

                          {/* ویرایش */}

                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() =>
                              openEditProduct(
                                product
                              )
                            }
                            title="ویرایش کالا"
                            style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
                          >
                            <Pencil
                              size={14}
                            />
                          </button>

                          {/* حذف */}

                          <button
                            className="btn btn-danger btn-small"
                            onClick={() =>
                              deleteProduct(
                                product.id
                              )
                            }
                            title="حذف کالا"
                            style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
                          >
                            <Trash2
                              size={14}
                            />
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 30 }}>
                      کالایی با این فیلترها پیدا نشد
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

      {/* =====================================================
          Modal ثبت / ویرایش
      ===================================================== */}

      {modal && (

        <div
          className="modal-backdrop"
          onMouseDown={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              closeModal();
            }

          }}
        >

          <div
            className="modal"
            style={{
              width:
                "min(850px, 100%)",
              maxWidth:
                "850px",
              maxHeight:
                "92vh",
              overflowY:
                "auto",
            }}
          >

            {/* Header */}

            <div
              className="modal-header"
            >

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 12,
                }}
              >

                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background:
                      "#f1f5f9",
                    display:
                      "grid",
                    placeItems:
                      "center",
                    color:
                      "#0f172a",
                  }}
                >

                  {editingProduct ? (
                    <Pencil
                      size={21}
                    />
                  ) : (
                    <PackagePlus
                      size={21}
                    />
                  )}

                </div>

                <div>

                  <h2>

                    {editingProduct
                      ? "ویرایش کالا"
                      : "ثبت کالای جدید"}

                  </h2>

                  <p>

                    {editingProduct
                      ? "اطلاعات کالا را ویرایش کنید"
                      : "اطلاعات کالا را وارد کنید"}

                  </p>

                </div>

              </div>

              <button
                className="close-btn"
                onClick={
                  closeModal
                }
              >
                <X
                  size={19}
                />
              </button>

            </div>

            {/* Form */}

            <div
              className="form-grid"
            >

              {/* نام */}

              <div
                className="form-field"
              >

                <label>
                  نام کالا
                  <span
                    style={{
                      color:
                        "#dc2626",
                      marginRight:
                        4,
                    }}
                  >
                    *
                  </span>
                </label>

                <input
                  className="input"
                  value={
                    form.name
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name:
                        e.target.value,
                    })
                  }
                  placeholder="مثلاً نوشابه کوکاکولا"
                />

              </div>

              {/* گروه */}

              <div
                className="form-field"
              >

                <label>
                  گروه کالا
                </label>

                <input
                  className="input"
                  value={
                    form.category
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category:
                        e.target.value,
                    })
                  }
                  placeholder="مثلاً نوشیدنی"
                />

              </div>

              {/* بارکد */}

              <div
                className="form-field"
              >

                <label>
                  بارکد
                </label>

                <input
                  className="input"
                  value={
                    form.barcode
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      barcode:
                        e.target.value,
                    })
                  }
                  placeholder="بارکد کالا"
                  inputMode="numeric"
                  dir="ltr"
                />

              </div>

              {/* واحد */}

              <div
                className="form-field"
              >

                <label>
                  واحد شمارش
                </label>

                <input
                  className="input"
                  value={
                    form.unit
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      unit:
                        e.target.value,
                    })
                  }
                  placeholder="مثلاً عدد، بطری، بسته"
                />

              </div>

              {/* تعداد کارتن */}

              <div
                className="form-field"
              >

                <label>
                  تعداد در کارتن
                </label>

                <input
                  className="input"
                  value={
                    form.quantity_per_carton
                  }
                  onChange={(e) =>
                    handleNumberChange(
                      "quantity_per_carton",
                      e.target.value
                    )
                  }
                  placeholder="مثلاً ۱۲"
                  inputMode="numeric"
                />

              </div>

              {/* قیمت */}

              <div
                className="form-field"
              >

                <label>
                  قیمت مصرف‌کننده
                </label>

                <div
                  style={{
                    position:
                      "relative",
                  }}
                >

                  <input
                    className="input"
                    value={
                      form.consumer_price
                    }
                    onChange={(e) =>
                      handleNumberChange(
                        "consumer_price",
                        e.target.value
                      )
                    }
                    placeholder="مثلاً ۱,۵۰۰,۰۰۰"
                    inputMode="numeric"
                    style={{
                      paddingLeft:
                        55,
                    }}
                  />

                  <span
                    style={{
                      position:
                        "absolute",
                      left: 12,
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color:
                        "#64748b",
                      fontSize: 12,
                      pointerEvents:
                        "none",
                    }}
                  >
                    ریال
                  </span>

                </div>

              </div>

              {/* موجودی */}

              <div
                className="form-field"
              >

                <label>
                  موجودی اولیه
                </label>

                <input
                  className="input"
                  value={
                    form.inventory
                  }
                  onChange={(e) =>
                    handleNumberChange(
                      "inventory",
                      e.target.value
                    )
                  }
                  placeholder="مثلاً ۱,۰۰۰"
                  inputMode="numeric"
                />

              </div>

              {/* تصویر */}

              <div
                className="form-field full"
              >

                <label>
                  تصویر کالا
                </label>

                <div
                  style={{
                    border:
                      "1px dashed #cbd5e1",
                    borderRadius:
                      14,
                    padding: 18,
                    background:
                      "#f8fafc",
                  }}
                >

                  {!imagePreview ? (

                    <button
                      type="button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      style={{
                        width:
                          "100%",
                        minHeight:
                          130,
                        border:
                          "none",
                        background:
                          "transparent",
                        cursor:
                          "pointer",
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        gap: 8,
                        color:
                          "#64748b",
                      }}
                    >

                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius:
                            12,
                          background:
                            "#e2e8f0",
                          display:
                            "grid",
                          placeItems:
                            "center",
                        }}
                      >
                        <Upload
                          size={21}
                        />
                      </div>

                      <strong
                        style={{
                          color:
                            "#334155",
                        }}
                      >
                        انتخاب تصویر کالا
                      </strong>

                      <span
                        style={{
                          fontSize:
                            11,
                        }}
                      >
                        JPG، PNG، WEBP
                        — حداکثر ۵ مگابایت
                      </span>

                    </button>

                  ) : (

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 16,
                        flexWrap:
                          "wrap",
                      }}
                    >

                      <img
                        src={
                          imagePreview
                        }
                        alt={
                          form.name
                        }
                        style={{
                          width: 120,
                          height: 120,
                          objectFit:
                            "cover",
                          borderRadius:
                            12,
                          border:
                            "1px solid #e2e8f0",
                        }}
                      />

                      <div
                        style={{
                          flex: 1,
                        }}
                      >

                        <strong
                          style={{
                            display:
                              "block",
                            marginBottom:
                              7,
                          }}
                        >
                          تصویر کالا
                        </strong>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            flexWrap:
                              "wrap",
                          }}
                        >

                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() =>
                              fileInputRef.current?.click()
                            }
                          >
                            تغییر تصویر
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger btn-small"
                            onClick={
                              removeSelectedImage
                            }
                          >
                            <Trash2
                              size={14}
                            />
                            حذف تصویر
                          </button>

                        </div>

                      </div>

                    </div>

                  )}

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    accept="image/*"
                    onChange={
                      handleImageChange
                    }
                    style={{
                      display:
                        "none",
                    }}
                  />

                </div>

              </div>

            </div>

            {/* Buttons */}

            <div
              style={{
                display:
                  "flex",
                gap: 9,
                marginTop:
                  20,
              }}
            >

              <button
                className="btn btn-primary"
                onClick={
                  saveProduct
                }
                disabled={
                  uploading
                }
              >

                {uploading
                  ? "در حال ذخیره..."
                  : editingProduct
                  ? "ذخیره تغییرات"
                  : "ثبت کالا"}

              </button>

              <button
                className="btn btn-secondary"
                onClick={
                  closeModal
                }
                disabled={
                  uploading
                }
              >
                انصراف
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          Bulk Excel Modal
      ===================================================== */}

      {bulkModal && (

        <div
          className="modal-backdrop"
          onMouseDown={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              closeBulkModal();
            }

          }}
        >

          <div
            className="modal"
            style={{
              width:
                "min(700px, 100%)",
              maxWidth:
                "700px",
            }}
          >

            {/* Header */}

            <div
              className="modal-header"
            >

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 12,
                }}
              >

                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background:
                      "#ecfdf5",
                    color:
                      "#059669",
                    display:
                      "grid",
                    placeItems:
                      "center",
                  }}
                >

                  <FileSpreadsheet
                    size={22}
                  />

                </div>

                <div>

                  <h2>
                    ورود گروهی کالاها
                  </h2>

                  <p>
                    کالاهای خود را با فایل Excel وارد کنید
                  </p>

                </div>

              </div>

              <button
                className="close-btn"
                onClick={
                  closeBulkModal
                }
              >
                <X
                  size={19}
                />
              </button>

            </div>

            {/* توضیحات */}

            <div
              style={{
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius:
                  14,
                padding: 16,
                marginBottom:
                  18,
              }}
            >

              <div
                style={{
                  fontWeight:
                    800,
                  marginBottom:
                    8,
                }}
              >
                روش ورود اطلاعات
              </div>

              <div
                style={{
                  color:
                    "#64748b",
                  fontSize:
                    13,
                  lineHeight:
                    1.9,
                }}
              >

                ابتدا نمونه Excel را دانلود کنید،
                اطلاعات کالاها را دقیقاً مطابق همان
                ستون‌ها وارد کنید و سپس فایل را انتخاب
                و ثبت کنید.

              </div>

            </div>

            {/* Download Template */}

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 12,
                padding:
                  14,
                border:
                  "1px solid #e2e8f0",
                borderRadius:
                  12,
                marginBottom:
                  16,
                flexWrap:
                  "wrap",
              }}
            >

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 10,
                }}
              >

                <FileSpreadsheet
                  size={20}
                />

                <div>

                  <strong>
                    نمونه فایل Excel
                  </strong>

                  <div
                    style={{
                      fontSize:
                        11,
                      color:
                        "#64748b",
                      marginTop:
                        3,
                    }}
                  >
                    فایل آماده برای ورود اطلاعات
                  </div>

                </div>

              </div>

              <button
                className="btn btn-secondary"
                onClick={
                  downloadExcelTemplate
                }
              >

                <Download
                  size={16}
                />

                دانلود نمونه

              </button>

            </div>

            {/* Upload */}

            <div
              className="form-field"
            >

              <label>
                فایل Excel
              </label>

              <button
                type="button"
                onClick={() =>
                  bulkFileRef.current?.click()
                }
                style={{
                  width:
                    "100%",
                  minHeight:
                    130,
                  border:
                    "1px dashed #cbd5e1",
                  borderRadius:
                    14,
                  background:
                    "#f8fafc",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  gap: 8,
                }}
              >

                <UploadCloud
                  size={27}
                  color="#64748b"
                />

                {bulkFile ? (

                  <>
                    <strong>
                      {bulkFile.name}
                    </strong>

                    <span
                      style={{
                        fontSize:
                          11,
                        color:
                          "#64748b",
                      }}
                    >
                      فایل انتخاب شد
                    </span>
                  </>

                ) : (

                  <>
                    <strong>
                      انتخاب فایل Excel
                    </strong>

                    <span
                      style={{
                        fontSize:
                          11,
                        color:
                          "#64748b",
                      }}
                    >
                      XLSX یا XLS
                    </span>
                  </>

                )}

              </button>

              <input
                ref={
                  bulkFileRef
                }
                type="file"
                accept=".xlsx,.xls"
                onChange={
                  handleBulkFileChange
                }
                style={{
                  display:
                    "none",
                }}
              />

            </div>

            {/* Excel columns */}

            <div
              style={{
                marginTop:
                  16,
                padding:
                  14,
                background:
                  "#fffbeb",
                border:
                  "1px solid #fde68a",
                borderRadius:
                  12,
                fontSize:
                  12,
                lineHeight:
                  1.9,
              }}
            >

              <strong>
                ستون‌های فایل:
              </strong>

              <div
                style={{
                  color:
                    "#92400e",
                  marginTop:
                    5,
                }}
              >
                نام کالا، گروه کالا، بارکد، واحد،
                تعداد در کارتن، قیمت مصرف کننده،
                موجودی
              </div>

            </div>

            {/* Results */}

            {bulkSuccessCount >
              0 && (

              <div
                style={{
                  marginTop:
                    16,
                  padding:
                    14,
                  background:
                    "#ecfdf5",
                  border:
                    "1px solid #a7f3d0",
                  borderRadius:
                    12,
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 9,
                  color:
                    "#047857",
                }}
              >

                <CheckCircle2
                  size={19}
                />

                <span>
                  {numberFa(
                    bulkSuccessCount
                  )}{" "}
                  کالا با موفقیت وارد شد.
                </span>

              </div>

            )}

            {bulkErrors.length >
              0 && (

              <div
                style={{
                  marginTop:
                    12,
                  padding:
                    14,
                  background:
                    "#fef2f2",
                  border:
                    "1px solid #fecaca",
                  borderRadius:
                    12,
                }}
              >

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 8,
                    color:
                      "#b91c1c",
                    fontWeight:
                      700,
                    marginBottom:
                      8,
                  }}
                >

                  <AlertCircle
                    size={18}
                  />

                  ردیف‌های دارای خطا

                </div>

                {bulkErrors.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={
                        index
                      }
                      style={{
                        fontSize:
                          12,
                        color:
                          "#7f1d1d",
                        marginTop:
                          5,
                      }}
                    >
                      ردیف{" "}
                      {numberFa(
                        item.row
                      )}{" "}
                      —{" "}
                      {item.error}
                    </div>

                  )
                )}

              </div>

            )}

            {/* Buttons */}

            <div
              style={{
                display:
                  "flex",
                gap: 9,
                marginTop:
                  20,
              }}
            >

              <button
                className="btn btn-primary"
                onClick={
                  importExcel
                }
                disabled={
                  bulkUploading ||
                  !bulkFile
                }
              >

                {bulkUploading
                  ? "در حال ورود کالاها..."
                  : "شروع ورود کالاها"}

              </button>

              <button
                className="btn btn-secondary"
                onClick={
                  closeBulkModal
                }
                disabled={
                  bulkUploading
                }
              >
                بستن
              </button>

            </div>

          </div>

        </div>

      )}

    </AppShell>
  );
}