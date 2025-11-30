"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, FileText, TrendingUp, Clock, Sparkles } from "lucide-react";
import { AgentSkill } from "@/types/skill";
import { SkillEditorModal } from "./SkillEditorModal";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "@/contexts/ToastContext";

interface AgentSkillsPanelProps {
  agentId: string;
}

interface SkillSuggestion {
  name: string;
  description: string;
  category: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
  estimatedUsefulness: number;
}

export function AgentSkillsPanel({ agentId }: AgentSkillsPanelProps) {
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null);
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadSkills();
  }, [agentId]);

  const loadSkills = async () => {
    try {
      const response = await fetch(`/api/skills?agentId=${agentId}`);
      if (response.ok) {
        const data = await response.json();
        setSkills(data.skills || []);
      }
    } catch (error) {
      console.error("Failed to load skills:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSkill = async (skillData: Partial<AgentSkill>) => {
    try {
      // Check if editing an existing skill (has _id) or creating new one
      const isUpdate = editingSkill?._id;
      const url = isUpdate
        ? `/api/skills?id=${editingSkill._id}`
        : "/api/skills";
      
      const method = isUpdate ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skillData),
      });

      if (response.ok) {
        await loadSkills();
        showToast(isUpdate ? "Skill updated successfully!" : "Skill created successfully!", "success");
        setIsEditorOpen(false);
        setEditingSkill(null);
      }
    } catch (error) {
      console.error("Failed to save skill:", error);
      throw error;
    }
  };

  const handleDeleteClick = (skillId: string, skillName: string) => {
    setDeleteConfirm({ id: skillId, name: skillName });
  };

  const handleDeleteSkill = async () => {
    if (!deleteConfirm) return;
    
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    
    try {
      const response = await fetch(`/api/skills?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadSkills();
        showToast("Skill deleted successfully!", "success");
      } else {
        showToast("Failed to delete skill", "error");
      }
    } catch (error) {
      console.error("Failed to delete skill:", error);
      showToast("Failed to delete skill", "error");
    }
  };

  const handleEditSkill = (skill: AgentSkill) => {
    setEditingSkill(skill);
    setIsEditorOpen(true);
  };

  const loadSuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const response = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action: "common_skills" }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Failed to load suggestions:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleUseSuggestion = async (suggestion: SkillSuggestion) => {
    // Generate relevant tags from the skill name and category
    const generateTags = () => {
      const tags = [suggestion.category.toLowerCase()];
      const nameParts = suggestion.name.toLowerCase().split(' ');
      tags.push(...nameParts.filter(part => part.length > 3));
      return tags.slice(0, 5); // Max 5 tags
    };

    // Show loading state
    setIsGeneratingContent(true);

    try {
      // Call AI to generate full skill content
      const response = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          action: "generate_content",
          skillName: suggestion.name,
          skillDescription: suggestion.description,
        }),
      });

      let fullContent = `# ${suggestion.name}\n\n## Overview\n${suggestion.description}\n\n## Capabilities\n- [Add capabilities]\n\n## Usage Guidelines\n[Add usage guidelines]`;
      
      if (response.ok) {
        const data = await response.json();
        fullContent = data.content || fullContent;
      }

      // Pre-fill the editor with AI-generated content
      setEditingSkill({
        name: suggestion.name,
        description: suggestion.description,
        version: "1.0.0",
        metadata: {
          category: suggestion.category,
          tags: generateTags(),
          author: "AI Generated",
        },
        skillContent: fullContent,
      } as AgentSkill);
      
      setIsEditorOpen(true);
      
      // Remove only this suggestion from the list, keep others
      setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
    } catch (error) {
      console.error("Failed to generate skill content:", error);
      // Fallback to template if AI generation fails
      setEditingSkill({
        name: suggestion.name,
        description: suggestion.description,
        version: "1.0.0",
        metadata: {
          category: suggestion.category,
          tags: generateTags(),
          author: "AI Suggested",
        },
        skillContent: `# ${suggestion.name}\n\n## Overview\n${suggestion.description}\n\n## Capabilities\n- [Add capabilities]\n\n## Usage Guidelines\n[Add usage guidelines]`,
      } as AgentSkill);
      setIsEditorOpen(true);
      
      // Remove only this suggestion from the list, keep others
      setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleNewSkill = () => {
    setEditingSkill(null);
    setIsEditorOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Loading Overlay - For generating skill content */}
      {isGeneratingContent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-md mx-4">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Generating Skill Content...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI is creating detailed content for this skill
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  This may take 15-30 seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Overlay - For loading suggestions */}
      {isLoadingSuggestions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-md mx-4">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-pink-200 dark:border-pink-900 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-pink-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Finding Perfect Skills...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI is analyzing your agent to suggest relevant skills
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  This may take 5-10 seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
    <div className="space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Skills ({skills.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enhance your agent with specialized capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSuggestions}
            disabled={isLoadingSuggestions}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {isLoadingSuggestions ? "Loading..." : "AI Suggest"}
          </button>
          <button
            onClick={handleNewSkill}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Skill
          </button>
        </div>
      </div>

      {/* AI Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Suggested Skills
            </h4>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-purple-600 hover:text-purple-700 text-sm"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      {suggestion.name}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {suggestion.description}
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                      {suggestion.reasoning}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUseSuggestion(suggestion)}
                    className="ml-3 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                  >
                    Use
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills List */}
      {skills.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No skills yet. Add your first skill to enhance this agent!
          </p>
          <button
            onClick={handleNewSkill}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Create First Skill
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {skills.map((skill) => (
            <div
              key={skill._id?.toString()}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-purple-500" />
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {skill.name}
                    </h4>
                    <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                      v{skill.version}
                    </span>
                    {skill.metadata?.category && (
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                        {skill.metadata.category}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {skill.description}
                  </p>

                  {/* Tags */}
                  {skill.metadata?.tags && skill.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {skill.metadata.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>Used {skill.usage?.timesInvoked || 0} times</span>
                    </div>
                    {skill.usage?.lastUsed && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          Last used {new Date(skill.usage.lastUsed).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEditSkill(skill)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit skill"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(skill._id!.toString(), skill.name)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete skill"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skill Editor Modal */}
      <SkillEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingSkill(null);
        }}
        onSave={handleSaveSkill}
        skill={editingSkill}
        agentId={agentId}
      />
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Skill"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteSkill}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
    </>
  );
}
