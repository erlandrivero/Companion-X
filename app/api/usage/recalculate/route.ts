import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

/**
 * POST /api/usage/recalculate - Recalculate all usage costs with updated pricing
 * This endpoint updates historical usage logs with correct pricing
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_URL?.includes('localhost');
    
    if (!session?.user?.email && !isDevelopment) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userId = session?.user?.email || "demo@localhost.dev";
    
    console.log("🔄 Starting cost recalculation for user:", userId);
    
    const db = await getDatabase();
    const collection = db.collection("usage_logs");
    
    // Get all usage logs for this user
    const logs = await collection.find({ userId }).toArray();
    console.log(`📊 Found ${logs.length} usage logs to recalculate`);
    
    let updated = 0;
    let totalOldCost = 0;
    let totalNewCost = 0;
    
    for (const log of logs) {
      const oldCost = log.cost || 0;
      totalOldCost += oldCost;
      
      let newCost = 0;
      
      if (log.service === "claude-haiku") {
        // New pricing: $1.00/M input, $5.00/M output, 0.1x for cached
        newCost = (
          (log.tokens?.input || 0) * 1.00 +
          (log.tokens?.output || 0) * 5.00 +
          (log.tokens?.cached || 0) * 0.10
        ) / 1_000_000;
      } else if (log.service === "claude-sonnet") {
        // Sonnet pricing: $3.00/M input, $15.00/M output, 0.3x for cached
        newCost = (
          (log.tokens?.input || 0) * 3.00 +
          (log.tokens?.output || 0) * 15.00 +
          (log.tokens?.cached || 0) * 0.30
        ) / 1_000_000;
      } else {
        // Keep other services as-is (elevenlabs, web-speech)
        newCost = oldCost;
      }
      
      totalNewCost += newCost;
      
      // Update the log with new cost
      if (newCost !== oldCost) {
        await collection.updateOne(
          { _id: log._id },
          { $set: { cost: newCost } }
        );
        updated++;
      }
    }
    
    const difference = totalNewCost - totalOldCost;
    const percentChange = totalOldCost > 0 ? ((totalNewCost / totalOldCost - 1) * 100) : 0;
    
    console.log(`✅ Recalculation complete!`);
    console.log(`📝 Updated ${updated} usage logs`);
    console.log(`💰 Old total: $${totalOldCost.toFixed(4)}`);
    console.log(`💰 New total: $${totalNewCost.toFixed(4)}`);
    console.log(`📈 Difference: $${difference.toFixed(4)} (${percentChange.toFixed(1)}%)`);
    
    return NextResponse.json({
      success: true,
      logsProcessed: logs.length,
      logsUpdated: updated,
      oldTotal: parseFloat(totalOldCost.toFixed(4)),
      newTotal: parseFloat(totalNewCost.toFixed(4)),
      difference: parseFloat(difference.toFixed(4)),
      percentChange: parseFloat(percentChange.toFixed(1)),
    });
  } catch (error) {
    console.error("Recalculate costs error:", error);
    return NextResponse.json(
      { error: "Failed to recalculate costs" },
      { status: 500 }
    );
  }
}
