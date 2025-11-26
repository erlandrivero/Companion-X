import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserUsageStats, getCurrentMonthCost } from "@/lib/db/usageDb";

// GET /api/usage - Get user's usage statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";

    const { searchParams} = new URL(request.url);
    const period = searchParams.get("period") || "current";

    const stats = await getUserUsageStats(userId, period as "current" | "history");
    const currentCost = await getCurrentMonthCost(userId);
    const monthlyBudget = parseFloat(process.env.DEFAULT_MONTHLY_BUDGET || "50");

    return NextResponse.json({
      stats,
      currentCost,
      monthlyBudget,
      percentUsed: (currentCost / monthlyBudget) * 100,
      remaining: monthlyBudget - currentCost,
    });
  } catch (error) {
    console.error("Get usage error:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}
