import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserSettings, saveUserSettings } from "@/lib/db/settingsDb";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch settings from database
    const settings = await getUserSettings(session.user.email);

    // Return settings or defaults
    return NextResponse.json({
      apiKeys: {
        // Don't send actual keys to client, just indicate if they're set
        hasAnthropic: !!settings?.apiKeys?.anthropic,
        hasElevenLabs: !!settings?.apiKeys?.elevenLabs,
        hasElevenLabsVoiceId: !!settings?.apiKeys?.elevenLabsVoiceId,
      },
      voice: settings?.voice || {
        speed: 1.15,
        pitch: 1.15,
        autoSendDelay: 2.0,
        volume: 1.0,
        voiceService: "auto",
        selectedVoice: "",
        autoRestartMic: true,
        voiceInterruption: true,
        continuousListening: false,
      },
      ai: settings?.ai || {
        responseLength: "concise",
        temperature: 0.3,
      },
      limits: settings?.limits || {
        enabled: false,
        maxTokensPerUser: 10000,
        maxRequestsPerHour: 20,
        maxCostPerUser: 5.0,
        requireAuth: true,
      },
      monthlyBudget: settings?.monthlyBudget || 50,
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await request.json();
    
    console.log("💾 Settings POST received for user:", session.user.email);
    console.log("💾 API Keys present:", {
      hasAnthropic: !!settings.apiKeys?.anthropic,
      hasElevenLabs: !!settings.apiKeys?.elevenLabs,
      hasVoiceId: !!settings.apiKeys?.elevenLabsVoiceId
    });

    // Validate settings
    if (settings.limits?.enabled) {
      if (settings.limits.maxTokensPerUser < 1000) {
        return NextResponse.json(
          { error: "Max tokens must be at least 1000" },
          { status: 400 }
        );
      }
      if (settings.limits.maxCostPerUser < 0.1) {
        return NextResponse.json(
          { error: "Max cost must be at least $0.10" },
          { status: 400 }
        );
      }
    }

    // Save to database
    console.log("💾 Attempting to save to database...");
    const success = await saveUserSettings(session.user.email, settings);
    console.log("💾 Save result:", success);

    if (!success) {
      console.error("❌ Failed to save settings to database");
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      );
    }

    console.log("✅ Settings saved successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
