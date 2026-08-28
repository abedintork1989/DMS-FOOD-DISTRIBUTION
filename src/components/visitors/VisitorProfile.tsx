"use client";

type VisitorProfileProps = {
  visitor: {
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    active: boolean;
    tracking_enabled: boolean;
    sales_channel?: {
      name: string;
    } | null;
  };
};

export default function VisitorProfile({
  visitor,
}: VisitorProfileProps) {
  return (
    <section
      className="dashboard-panel"
      style={{
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >

        {visitor.avatar_url ? (
          <img
            src={visitor.avatar_url}
            alt=""
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width:80,
              height:80,
              borderRadius:"50%",
              display:"grid",
              placeItems:"center",
              background:"#e9f4ef",
              color:"#0f6b43",
              fontSize:30,
              fontWeight:900,
            }}
          >
            {visitor.full_name[0]}
          </div>
        )}

        <div>
          <h2 style={{margin:0}}>
            {visitor.full_name}
          </h2>

          <p style={{margin:"8px 0"}}>
            {visitor.phone || "-"}
          </p>

          <span>
            {visitor.sales_channel?.name || "-"}
          </span>
        </div>

      </div>


      <div
        style={{
          marginTop:20,
          display:"grid",
          gap:10,
        }}
      >

        <div>
          وضعیت:
          {" "}
          <b>
          {visitor.active
            ? "فعال"
            : "غیرفعال"}
          </b>
        </div>


        <div>
          ردیابی:
          {" "}
          <b>
          {visitor.tracking_enabled
            ? "فعال"
            : "خاموش"}
          </b>
        </div>

      </div>

    </section>
  );
}