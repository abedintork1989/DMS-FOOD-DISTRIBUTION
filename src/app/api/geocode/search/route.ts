import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json(
      { error: "عبارت جستجو باید حداقل ۲ کاراکتر باشد." },
      { status: 400 }
    );
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ir");
  url.searchParams.set("accept-language", "fa");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "fa,en;q=0.8",
        "User-Agent": "DMS-Food-Distribution/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `سرویس جستجوی نقشه پاسخ نامعتبر داد (${response.status}).` },
        { status: 502 }
      );
    }

    const data = await response.json();

    const results = Array.isArray(data)
      ? data
          .map((item: any) => ({
            latitude: Number(item?.lat),
            longitude: Number(item?.lon),
            displayName: String(item?.display_name || ""),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.latitude) &&
              Number.isFinite(item.longitude)
          )
      : [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("SEARCH GEOCODING ERROR:", error);

    return NextResponse.json(
      { error: "ارتباط با سرویس جستجوی نقشه برقرار نشد." },
      { status: 502 }
    );
  }
}
