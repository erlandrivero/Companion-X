import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/db/settingsDb";
import { getUserUsage } from "@/lib/db/usageLimitsDb";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || "demo@localhost.dev";

    // Check if user has custom API key
    const userSettings = await getUserSettings(userId);
    const hasCustomKey = !!userSettings?.apiKeys?.anthropic;

    // If user has custom key, they're not on trial
    if (hasCustomKey) {
      return NextResponse.json({
        onTrial: false,
        hasCustomKey: true,
      });
    }

    // Get usage stats for trial users
    const settings = userSettings?.limits?.enabled ? userSettings.limits : {
      enabled: true,
      maxTokensPerUser: 10000,
      maxRequestsPerHour: 20,
      maxCostPerUser: 1.0,
    };

    const usage = await getUserUsage(userId);

    return NextResponse.json({
      onTrial: true,
      hasCustomKey: false,
      tokensUsed: usage.tokensUsed || 0,
      tokensLimit: settings.maxTokensPerUser,
      requestsUsed: usage.requestsThisHour || 0,
      requestsLimit: settings.maxRequestsPerHour,
      costUsed: usage.costAccumulated || 0,
      costLimit: settings.maxCostPerUser,
    });
  } catch (error) {
    console.error("Usage stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 }
    );
  }
}
