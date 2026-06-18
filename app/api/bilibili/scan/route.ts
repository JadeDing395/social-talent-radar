import { NextRequest } from "next/server";
import { handleScan, corsOptionsResponse } from "@/lib/scan-handler";
import { bilibiliAdapter } from "@/lib/bilibili";

export const OPTIONS = corsOptionsResponse;

export async function POST(req: NextRequest) {
  return handleScan(req, bilibiliAdapter);
}
