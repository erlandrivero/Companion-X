import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConversation } from "@/lib/db/conversationDb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: sessionId } = await params;
    
    const conversation = await getConversation(sessionId, userId);
    
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Failed to load conversation:", error);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}
