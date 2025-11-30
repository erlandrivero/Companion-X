import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserConversations, deleteConversation } from "@/lib/db/conversationDb";

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
    
    // Get limit from query params (default 50)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const conversations = await getUserConversations(userId, limit);
    
    // Format conversations for UI
    const formattedConversations = conversations.map((conv) => {
      // Generate title from first user message or use default
      let title = "New Conversation";
      const firstUserMessage = conv.messages.find(m => m.role === "user");
      if (firstUserMessage) {
        // Use first 50 chars of first message as title
        title = firstUserMessage.content.substring(0, 50);
        if (firstUserMessage.content.length > 50) {
          title += "...";
        }
      }
      
      // Get message count
      const messageCount = conv.messages.length;
      
      // Get last message preview
      const lastMessage = conv.messages[conv.messages.length - 1];
      const preview = lastMessage 
        ? lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? "..." : "")
        : "";
      
      return {
        id: conv.sessionId,
        title,
        preview,
        messageCount,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        agentsSuggested: conv.agentsSuggested,
      };
    });
    
    return NextResponse.json(formattedConversations);
  } catch (error) {
    console.error("Failed to load conversations:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { sessionId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }
    
    const deleted = await deleteConversation(sessionId, userId);
    
    if (deleted) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
