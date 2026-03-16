import { NextRequest, NextResponse } from "next/server";
import {
  buildPaymentTransaction,
  generateInvoiceParams,
} from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const { userWallet } = await req.json();
    if (!userWallet) {
      return NextResponse.json(
        { error: "userWallet is required" },
        { status: 400 }
      );
    }

    const invoice = generateInvoiceParams();
    const transaction = await buildPaymentTransaction({
      userWallet,
      amount: invoice.amount,
      memo: invoice.memo,
      startTime: invoice.startTime,
      endTime: invoice.endTime,
    });

    return NextResponse.json({ transaction, invoice });
  } catch (err: unknown) {
    console.error("[build-transaction]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
