import { NextRequest } from "next/server";
import { handleScan, corsOptionsResponse } from "@/lib/scan-handler";
import { githubAdapter } from "@/lib/github";

export const OPTIONS = corsOptionsResponse;

export async function POST(req: NextRequest) {
  return handleScan(req, githubAdapter);
}
