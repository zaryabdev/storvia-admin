import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

const fields = ["legalName", "billingContactName", "billingEmail", "billingPhone", "addressLine1", "addressLine2", "city", "postalCode", "country", "taxNumber", "companyRegistrationNumber", "currency"] as const;
type Field = (typeof fields)[number];

function normalize(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthenticated", { status: 401 });
  const store = await prismadb.store.findFirst({ where: { id: params.storeId, userId }, select: { id: true } });
  if (!store) return new NextResponse("Forbidden", { status: 403 });
  const profile = await prismadb.storeBillingProfile.findUnique({ where: { storeId: store.id } });
  return NextResponse.json(profile);
}

export async function PATCH(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthenticated", { status: 401 });
    const store = await prismadb.store.findFirst({ where: { id: params.storeId, userId }, select: { id: true } });
    if (!store) return new NextResponse("Forbidden", { status: 403 });
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const field of fields) if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = normalize(body[field]);
    if (data.billingEmail && (typeof data.billingEmail !== "string" || !/^\S+@\S+\.\S+$/.test(data.billingEmail))) return new NextResponse("Invalid billing email", { status: 400 });
    if (data.currency !== null && data.currency !== undefined && (typeof data.currency !== "string" || !/^[A-Za-z]{3}$/.test(data.currency))) return new NextResponse("Currency must be a 3-letter ISO code", { status: 400 });
    if (typeof data.currency === "string") data.currency = data.currency.toUpperCase();
    if (data.currency === null) data.currency = "PKR";
    for (const [key, value] of Object.entries(data)) if (typeof value === "string" && value.length > 255) return new NextResponse(`${key} is too long`, { status: 400 });
    const profile = await prismadb.storeBillingProfile.upsert({ where: { storeId: store.id }, create: { storeId: store.id, ...(data as any) }, update: data as any });
    return NextResponse.json(profile);
  } catch (error) {
    console.log("[BILLING_PROFILE_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
