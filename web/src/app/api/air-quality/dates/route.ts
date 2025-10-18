import { NextResponse } from "next/server";

import { getAvailableDates } from "@/lib/airQuality";

export const revalidate = 0;

export async function GET() {
  try {
    const dates = getAvailableDates();
    return NextResponse.json({ dates });
  } catch (error) {
    console.error("Failed to load available dates", error);
    return NextResponse.json(
      { message: "Failed to load available dates." },
      { status: 500 },
    );
  }
}
