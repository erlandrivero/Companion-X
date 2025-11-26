import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsageSummary } from "@/lib/db/usageLimitsDb";
import { getUserSettings } from "@/lib/db/settingsDb";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || "demo@localhost.dev";

    // Get user's limits from settings
    const settings = await getUserSettings(userId);
    const limits = settings?.limits?.enabled ? settings.limits : {
      enabled: true,
      maxTokensPerUser: 10000,
      maxRequestsPerHour: 20,
      maxCostPerUser: 1.0,
      requireAuth: true,
    };

    // Get usage summary
    const summary = await getUsageSummary(userId, {
      maxTokensPerDay: limits.maxTokensPerUser,
      maxRequestsPerHour: limits.maxRequestsPerHour,
      maxCostPerDay: limits.maxCostPerUser,
      requireAuth: limits.requireAuth,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Usage summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
