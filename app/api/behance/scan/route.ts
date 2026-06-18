import { NextRequest } from "next/server";
import { handleScan, corsOptionsResponse } from "@/lib/scan-handler";
import { behanceAdapter } from "@/lib/behance";

export const OPTIONS = corsOptionsResponse;

export async function POST(req: NextRequest) {
  return handleScan(req, behanceAdapter);
}
