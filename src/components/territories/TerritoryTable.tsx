"use client";

type TerritoryRow = {
  id: string;
  province?: string;
  county?: string;
  city?: string;
  name?: string;
  activityType?: string;
};

type Props = {
  territories: TerritoryRow[];
  onEdit?: (item: TerritoryRow) => void;
  onDelete?: (id: string) => void;
};

export default function TerritoryTable({
  territories,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div
      style={{
        width: "100%",
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          direction: "rtl",
        }}
      >
        <thead>
          <tr>
            {[
              "استان",
              "شهرستان",
              "شهر",
              "منطقه",
              "نوع فعالیت",
              "عملیات",
            ].map((title) => (
              <th
                key={title}
                style={{
                  padding: 12,
                  textAlign: "center",
                  borderBottom: "1px solid #ddd",
                }}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {territories.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                style={{
                  padding: 30,
                  textAlign: "center",
                }}
              >
                هنوز منطقه‌ای ثبت نشده است
              </td>
            </tr>
          ) : (
            territories.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: 12 }}>
                  {item.province || "-"}
                </td>
                <td style={{ padding: 12 }}>
                  {item.county || "-"}
                </td>
                <td style={{ padding: 12 }}>
                  {item.city || "-"}
                </td>
                <td style={{ padding: 12 }}>
                  {item.name || "-"}
                </td>
                <td style={{ padding: 12 }}>
                  {item.activityType || "-"}
                </td>
                <td style={{ padding: 12 }}>
                  <button
                    onClick={() => onEdit?.(item)}
                    style={{
                      marginLeft: 8,
                      cursor: "pointer",
                    }}
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => onDelete?.(item.id)}
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
