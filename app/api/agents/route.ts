import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAgents, createAgent, deleteAgent, updateAgent } from "@/lib/db/agentDb";
import { generateAgentProfile } from "@/lib/ai/agentCreator";
import { getApiKeys } from "@/lib/db/settingsDb";

// GET /api/agents - Get all user's agents
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";

    const agents = await getUserAgents(userId);
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Get agents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";

    const { topic, context } = await request.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    // Check agent limit
    const existingAgents = await getUserAgents(userId);
    if (existingAgents.length >= 50) {
      return NextResponse.json(
        { error: "Maximum agent limit reached (50)" },
        { status: 400 }
      );
    }

    // Get user's API key with fallback to environment variable
    const { anthropic: userApiKey } = await getApiKeys(userId);

    // Generate agent profile
    const agentProfile = await generateAgentProfile(topic, context || "", userApiKey);

    // Create agent
    const agent = await createAgent(
      {
        name: agentProfile.name,
        description: agentProfile.description,
        expertise: agentProfile.expertise,
        systemPrompt: agentProfile.systemPrompt,
        knowledgeBase: agentProfile.knowledgeBase,
        capabilities: agentProfile.capabilities,
        conversationStyle: agentProfile.conversationStyle,
      },
      userId
    );

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error("Create agent error:", error);
    return NextResponse.json(
      {
        error: "Failed to create agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/agents - Update an agent
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("id");

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    const updates = await request.json();

    // Only allow updating certain fields
    const allowedFields = ["name", "description", "expertise", "systemPrompt"];
    const filteredUpdates: any = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updatedAgent = await updateAgent(agentId, userId, filteredUpdates);

    if (!updatedAgent) {
      return NextResponse.json(
        { error: "Agent not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent: updatedAgent });
  } catch (error) {
    console.error("Update agent error:", error);
    return NextResponse.json(
      {
        error: "Failed to update agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/agents - Delete an agent
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("id");

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    const success = await deleteAgent(agentId, userId);

    if (!success) {
      return NextResponse.json(
        { error: "Agent not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete agent error:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
