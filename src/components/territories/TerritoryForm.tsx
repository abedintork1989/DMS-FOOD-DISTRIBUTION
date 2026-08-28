"use client";

import { useState } from "react";

type Props = {
  geometry: any;
  onSave: (data: any) => void;
  onCancel: () => void;
};

export default function TerritoryForm({
  geometry,
  onSave,
  onCancel,
}: Props) {
  const [form, setForm] = useState({
    province: "",
    county: "",
    city: "",
    name: "",
    activityType: "",
  });

  function update(
    key: string,
    value: string
  ) {
    setForm((old) => ({
      ...old,
      [key]: value,
    }));
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 7000,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 400,
          background: "#fff",
          padding: 25,
          borderRadius: 18,
          direction: "rtl",
        }}
      >
        <h3>ثبت اطلاعات منطقه</h3>

        {[
          ["province", "استان"],
          ["county", "شهرستان"],
          ["city", "شهر"],
          ["name", "نام منطقه"],
        ].map(([key, title]) => (
          <input
            key={key}
            placeholder={title}
            value={(form as any)[key]}
            onChange={(e) =>
              update(key, e.target.value)
            }
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          />
        ))}

        <select
          value={form.activityType}
          onChange={(e) =>
            update("activityType", e.target.value)
          }
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 15,
          }}
        >
          <option value="">
            نوع فعالیت
          </option>
          <option value="VIP">
            VIP
          </option>
          <option value="زنجیره‌ای">
            زنجیره‌ای
          </option>
          <option value="عمده فروشی">
            عمده فروشی
          </option>
          <option value="سوپرمارکت">
            سوپرمارکت
          </option>
        </select>

        <button
          onClick={() =>
            onSave({
              ...form,
              geometry,
              id: Date.now().toString(),
            })
          }
          style={{
            width: "100%",
            padding: 12,
            background: "#16a34a",
            color: "#fff",
            border: 0,
            borderRadius: 10,
            marginBottom: 10,
          }}
        >
          ثبت منطقه
        </button>

        <button
          onClick={onCancel}
          style={{
            width: "100%",
            padding: 12,
          }}
        >
          انصراف
        </button>
      </div>
    </div>
  );
}
