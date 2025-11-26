import { ObjectId } from "mongodb";

export interface AgentSkill {
  _id?: ObjectId | string;
  agentId: string;
  name: string;
  description: string;
  version: string;
  skillContent: string; // Full SKILL.md content
  resources: SkillResource[];
  metadata: SkillMetadata;
  usage: SkillUsage;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillResource {
  filename: string;
  content: string;
  type: "markdown" | "script" | "template" | "data";
}

export interface SkillMetadata {
  dependencies: string[];
  tags: string[];
  author: string;
  category: string;
}

export interface SkillUsage {
  timesInvoked: number;
  lastUsed: Date;
  successRate: number;
  averageResponseTime: number;
}

export interface SkillMatchResult {
  skill: AgentSkill;
  relevanceScore: number;
  reasoning: string;
}

export interface ParsedSkill {
  metadata: {
    name: string;
    description: string;
    version?: string;
    dependencies?: string[];
  };
  content: {
    overview?: string;
    capabilities?: string[];
    guidelines?: {
      dos: string[];
      donts: string[];
    };
    examples?: string[];
    resources?: string[];
  };
  rawContent: string;
}
