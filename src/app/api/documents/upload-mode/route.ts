import { NextResponse } from "next/server";
import { isS3Storage } from "@/lib/storage";

export async function GET() {
  return NextResponse.json({ directUpload: isS3Storage() });
}
