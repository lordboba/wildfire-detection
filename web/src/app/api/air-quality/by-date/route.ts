import { NextResponse } from "next/server";

import {
  getHourlyAverages,
  getRowsByDate,
  getAvailableDates,
} from "@/lib/airQuality";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { message: "Query parameter 'date' is required." },
        { status: 400 },
      );
    }

    const knownDates = new Set(getAvailableDates());
    if (!knownDates.has(date)) {
      return NextResponse.json(
        { message: `No readings found for date ${date}.` },
        { status: 404 },
      );
    }

    const hourly = getHourlyAverages(date);
    const rows = getRowsByDate(date);

    return NextResponse.json({ hourly, rows });
  } catch (error) {
    console.error("Failed to load air quality data", error);
    return NextResponse.json(
      { message: "Failed to load air quality readings." },
      { status: 500 },
    );
  }
}
