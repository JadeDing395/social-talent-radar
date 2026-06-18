import { NextResponse } from "next/server";
import { behanceAdapter } from "@/lib/behance";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  const status = await behanceAdapter.checkLogin();
  return NextResponse.json(status, { headers: CORS });
}
