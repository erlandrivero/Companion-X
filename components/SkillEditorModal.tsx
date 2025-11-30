"use client";

import { useState, useEffect } from "react";
import { X, Save, FileText, Info } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { AgentSkill } from "@/types/skill";

interface SkillEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (skill: Partial<AgentSkill>) => Promise<void>;
  skill?: AgentSkill | null;
  agentId: string;
}

export function SkillEditorModal({ isOpen, onClose, onSave, skill, agentId }: SkillEditorModalProps) {
  const [name, setName] = useState(skill?.name || "");
  const [description, setDescription] = useState(skill?.description || "");
  const [version, setVersion] = useState(skill?.version || "1.0.0");
  const [skillContent, setSkillContent] = useState(skill?.skillContent || "");
  const [category, setCategory] = useState(skill?.metadata?.category || "");
  const [tags, setTags] = useState(skill?.metadata?.tags?.join(", ") || "");
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  // Update form fields when skill prop changes
  useEffect(() => {
    if (skill) {
      setName(skill.name || "");
      setDescription(skill.description || "");
      setVersion(skill.version || "1.0.0");
      setSkillContent(skill.skillContent || "");
      setCategory(skill.metadata?.category || "");
      setTags(skill.metadata?.tags?.join(", ") || "");
    } else {
      // Reset form for new skill
      setName("");
      setDescription("");
      setVersion("1.0.0");
      setSkillContent("");
      setCategory("");
      setTags("");
    }
  }, [skill, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const skillData: Partial<AgentSkill> = {
        agentId,
        name,
        description,
        version,
        skillContent,
        metadata: {
          category,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
          dependencies: [],
          author: "User",
        },
        resources: [],
        usage: skill?.usage || {
          timesInvoked: 0,
          lastUsed: new Date(),
          successRate: 0,
          averageResponseTime: 0,
        },
      };

      await onSave(skillData);
      showToast("Skill saved successfully!", "success");
      onClose();
    } catch (error) {
      console.error("Failed to save skill:", error);
      showToast("Failed to save skill. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const skillTemplate = `# ${name || "Skill Name"}

## Overview
Brief description of what this skill does.

## Capabilities
- Capability 1
- Capability 2
- Capability 3

## Guidelines

### DO:
- Best practice 1
- Best practice 2

### DON'T:
- Anti-pattern 1
- Anti-pattern 2

## Examples

### Example 1
\`\`\`
Code or example here
\`\`\`

## Resources
- Resource 1
- Resource 2
`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {skill ? "Edit Skill" : "New Skill"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Skills enhance your agent's capabilities
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Skills are automatically loaded when relevant to the conversation. Use SKILL.md format for best results.
                </p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Skill Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Data Analysis"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this skill does..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Tableau, Fishing, Data Analysis"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
              <p className="text-xs text-gray-500 mt-1">
                Common: Tableau, Fishing, Programming, Data Analysis
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tableau, excel, python (comma-separated)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Skill Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Skill Content (SKILL.md format)</label>
              <button
                onClick={() => setSkillContent(skillTemplate)}
                className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                Use Template
              </button>
            </div>
            <textarea
              value={skillContent}
              onChange={(e) => setSkillContent(e.target.value)}
              placeholder="Enter skill content in SKILL.md format..."
              rows={15}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 font-mono text-sm resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use markdown format. Include overview, capabilities, guidelines, and examples.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !description || isSaving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Skill"}
          </button>
        </div>
      </div>
    </div>
  );
}
