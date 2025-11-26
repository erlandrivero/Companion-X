import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // This endpoint is currently not used - Web Speech API is used instead
    // If ElevenLabs integration is needed in the future, implement it here
    return NextResponse.json(
      { error: "Voice synthesis endpoint not implemented. Using Web Speech API." },
      { status: 501 }
    );
  } catch (error) {
    console.error("Voice synthesis error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
