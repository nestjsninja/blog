import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const { email } = (await req.json()) as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!apiKey || !audienceId) {
    return NextResponse.json(
      { error: "Newsletter not configured" },
      { status: 503 }
    );
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.contacts.create({
    email,
    audienceId,
    unsubscribed: false,
  });

  if (error) {
    console.error("[subscribe]", error);
    return NextResponse.json(
      { error: "Could not subscribe, please try again" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
