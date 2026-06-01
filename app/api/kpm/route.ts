import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getKpmForUser } from "@/lib/data";

export async function GET() {
  const user = await getSession();
  const data = await getKpmForUser(user);
  return NextResponse.json(data);
}
