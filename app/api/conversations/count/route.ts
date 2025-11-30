import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserConversationCount } from "@/lib/db/conversationDb";

export async function GET(request: NextRequest) {
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
    
    const count = await getUserConversationCount(userId);
    
    return NextResponse.json({ count }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Failed to get conversation count:", error);
    return NextResponse.json(
      { error: "Failed to get conversation count" },
      { status: 500 }
    );
  }
}
