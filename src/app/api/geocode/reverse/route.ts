import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

function cleanAddressPart(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[\s،,؛;\-–—]+|[\s،,؛;\-–—]+$/g, "")
    .trim();
}

function buildCompactPersianAddress(address: Record<string, unknown>): string {
  const rawParts = [
    address.province,
    address.state,
    address.city,
    address.county,
    address.municipality,
    address.town,
    address.suburb,
    address.city_district,
    address.district,
    address.neighbourhood,
    address.quarter,
    address.road,
    address.street,
    address.pedestrian,
    address.footway,
    address.house_number,
    address.postcode,
  ];

  const parts: string[] = [];

  for (const raw of rawParts) {
    const part = cleanAddressPart(raw);
    if (!part) continue;

    const normalized = part.replace(/[\u200c\s]+/g, " ").trim();
    const alreadyExists = parts.some(
      (item) => item.replace(/[\u200c\s]+/g, " ").trim() === normalized
    );

    if (!alreadyExists) {
      parts.push(part);
    }
  }

  return parts.join("، ");
}

function extractCity(address: Record<string, unknown>): string {
  const candidates = [
    address.city,
    address.town,
    address.municipality,
    address.village,
    address.county,
  ];

  for (const candidate of candidates) {
    const value = cleanAddressPart(candidate);
    if (value) return value;
  }

  return "";
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "مختصات نامعتبر است." },
      { status: 400 }
    );
  }

  if (latitude < 24 || latitude > 40.5 || longitude < 43 || longitude > 63.5) {
    return NextResponse.json(
      { error: "موقعیت انتخاب‌شده خارج از محدوده ایران است." },
      { status: 400 }
    );
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("layer", "address");
  url.searchParams.set("accept-language", "fa");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "fa,en;q=0.8",
        "User-Agent": "DMS-Food-Distribution/1.0",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `سرویس دریافت آدرس پاسخ نامعتبر داد (${response.status}).` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const addressParts = (data?.address || {}) as Record<string, unknown>;

    const address = buildCompactPersianAddress(addressParts);
    const province = cleanAddressPart(
      addressParts.province || addressParts.state || ""
    );
    const city = extractCity(addressParts);

    if (!address) {
      return NextResponse.json(
        { error: "برای این مختصات آدرس قابل شناسایی پیدا نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({ address, province, city });
  } catch (error) {
    console.error("REVERSE GEOCODING ERROR:", error);
    return NextResponse.json(
      { error: "ارتباط با سرویس دریافت آدرس برقرار نشد." },
      { status: 502 }
    );
  }
}
