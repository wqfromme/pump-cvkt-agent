import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentWithRetry } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const { user, amount, memo, startTime, endTime, prompt } =
      await req.json();

    if (!user || !amount || !memo || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing invoice parameters" },
        { status: 400 }
      );
    }

    const paid = await verifyPaymentWithRetry({
      user,
      amount: Number(amount),
      memo: Number(memo),
      startTime: Number(startTime),
      endTime: Number(endTime),
    });

    if (!paid) {
      return NextResponse.json(
        { error: "Payment not verified on-chain" },
        { status: 402 }
      );
    }

    // ── Deliver the service ─────────────────────────────────────────────────
    const userPrompt =
      prompt?.trim() || "Tell me something fascinating about Solana.";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      throw new Error(`Anthropic API error: ${anthropicRes.status}`);
    }

    const data = await anthropicRes.json();
    const responseText = data.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    return NextResponse.json({ success: true, response: responseText });
  } catch (err: unknown) {
    console.error("[verify-payment]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
