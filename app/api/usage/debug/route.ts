import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

/**
 * GET /api/usage/debug - Debug endpoint to see raw usage logs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || "demo@localhost.dev";
    
    const db = await getDatabase();
    const collection = db.collection("usage_logs");
    
    // Get all logs for this user
    const allLogs = await collection.find({ userId }).sort({ timestamp: -1 }).limit(10).toArray();
    
    // Get current month logs
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startOfMonth = new Date(currentMonth + "-01");
    const currentMonthLogs = await collection.find({
      userId,
      timestamp: { $gte: startOfMonth },
    }).toArray();
    
    // Calculate total
    const totalCost = currentMonthLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    
    return NextResponse.json({
      userId,
      currentMonth,
      startOfMonth,
      totalLogs: allLogs.length,
      currentMonthLogs: currentMonthLogs.length,
      totalCost,
      recentLogs: allLogs.map(log => ({
        timestamp: log.timestamp,
        service: log.service,
        tokens: log.tokens,
        cost: log.cost,
        userId: log.userId,
      })),
      currentMonthLogsDetail: currentMonthLogs.map(log => ({
        timestamp: log.timestamp,
        service: log.service,
        tokens: log.tokens,
        cost: log.cost,
      })),
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug info", details: String(error) },
      { status: 500 }
    );
  }
}
