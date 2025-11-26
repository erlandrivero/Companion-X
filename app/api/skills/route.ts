import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAgentSkills, createSkill, updateSkill, deleteSkill } from "@/lib/db/skillDb";
import { getAgent } from "@/lib/db/agentDb";
import { generateSkill } from "@/lib/ai/skillMatcher";

// GET /api/skills?agentId=xxx - Get all skills for an agent
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || "demo@localhost.dev";

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    // Verify agent ownership
    const agent = await getAgent(agentId, userId);
    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or unauthorized" },
        { status: 404 }
      );
    }

    const skills = await getAgentSkills(agentId);
    return NextResponse.json({ skills });
  } catch (error) {
    console.error("Get skills error:", error);
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    );
  }
}

// POST /api/skills - Create a new skill
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || "demo@localhost.dev";

    const skillData = await request.json();
    const { agentId, name, description, skillContent, metadata, version } = skillData;

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    if (!name || !description) {
      return NextResponse.json(
        { error: "Name and description are required" },
        { status: 400 }
      );
    }

    // Verify agent ownership
    const agent = await getAgent(agentId, userId);
    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or unauthorized" },
        { status: 404 }
      );
    }

    // Use provided skill content or create basic template
    const finalSkillContent = skillContent || `# ${name}

## Overview
${description}

## Core Capabilities
- Capability 1
- Capability 2

## Guidelines
✅ DO:
- Guideline 1

❌ DON'T:
- Anti-pattern 1
`;

    const skill = await createSkill(
      {
        agentId,
        name,
        description,
        version: version || "1.0.0",
        skillContent: finalSkillContent,
        resources: [],
        metadata: metadata || {
          dependencies: [],
          tags: [],
          author: userId,
          category: "custom",
        },
      },
      agentId
    );

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    console.error("Create skill error:", error);
    return NextResponse.json(
      {
        error: "Failed to create skill",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/skills?id=xxx - Update a skill
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || "demo@localhost.dev";

    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get("id");

    if (!skillId) {
      return NextResponse.json(
        { error: "Skill ID is required" },
        { status: 400 }
      );
    }

    const updates = await request.json();

    // Only allow updating certain fields
    const allowedFields = ["name", "description", "skillContent", "version", "metadata", "resources"];
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

    const updatedSkill = await updateSkill(skillId, filteredUpdates);

    if (!updatedSkill) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ skill: updatedSkill });
  } catch (error) {
    console.error("Update skill error:", error);
    return NextResponse.json(
      {
        error: "Failed to update skill",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/skills?id=xxx - Delete a skill
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get("id");

    if (!skillId) {
      return NextResponse.json(
        { error: "Skill ID is required" },
        { status: 400 }
      );
    }

    const success = await deleteSkill(skillId);

    if (!success) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete skill error:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 }
    );
  }
}
