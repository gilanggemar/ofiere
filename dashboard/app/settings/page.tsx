"use client";

import { useSocket, useSocketStore } from "@/lib/useSocket";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Settings,
  RotateCcw,
  Shield,
  Bell,
  Cpu,
  Wifi,
  AlertTriangle,
  Server,
  EyeOff,
  Eye,
  ChevronDown,
  X,
  Plus,
  FolderCode,
  Tag,
  Search,
  Heart,
  Zap,
  Trash2,
  Wrench,
  Code2,
  ShieldAlert,
  Loader2,
  Settings2,
  Sparkles,
  Puzzle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import ConnectionProfiles from "@/components/settings/ConnectionProfiles";
import { PluginInstall } from "@/components/settings/PluginInstall";
import { AddModelDialog } from "@/components/settings/AddModelDialog";
import { ConfigureModelDialog } from "@/components/settings/ConfigureModelDialog";
import { useRouter } from "next/navigation";

import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";
import { useOpenClawCapabilitiesStore } from "@/stores/useOpenClawCapabilitiesStore";
import {
  useOpenClawModelStore,
  type ModelCatalogEntry,
  type ModelRole,
  AGENT_MODEL_ROLES,
  COMPANION_MODEL_ROLES,
} from "@/stores/useOpenClawModelStore";
import { useCustomModelStore } from "@/stores/useCustomModelStore";
import { useOpenClawStore } from "@/store/useOpenClawStore";
import { getAgentProfile } from "@/lib/agentRoster";
import { AnimatePresence, motion } from "framer-motion";

export default function SettingsPage() {
  const { agents, isConnected } = useSocketStore();
  const { sendConfigUpdate } = useSocket();
  const {
    hiddenAgentIds,
    setAgentVisibility,
    agentTags,
    addTagToAgent,
    removeTagFromAgent,
  } = useAgentSettingsStore();
  const router = useRouter();
  const setActiveTab = useOpenClawCapabilitiesStore((s) => s.setActiveTab);
  const setTargetAgent = useOpenClawCapabilitiesStore(
    (s) => s.setSelectedAgentId,
  );

  // Model store
  const openClawConnected = useOpenClawStore((s) => s.isConnected);
  const {
    activeModels: activeModelsByRole,
    defaults: modelDefaults,
    modelCatalog,
    isModelLoading,
    fetchModels,
    bufferChange,
    hasUnsavedChanges,
    pendingChanges,
    applyAllChanges,
    discardAllChanges,
    isApplying,
  } = useOpenClawModelStore();

  // Convenience accessors for legacy compatibility
  const activeModels = activeModelsByRole.primary;
  const activeHeartbeatModels = activeModelsByRole.heartbeat;
  const defaultModel = modelDefaults.primary;
  const defaultHeartbeatModel = modelDefaults.heartbeat;

  // Custom model store
  const {
    models: customModels,
    fetchModels: fetchCustomModels,
    hasFetched: customModelsFetched,
    removeModel: removeCustomModel,
  } = useCustomModelStore();

  const [autoRestart, setAutoRestart] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Track which agent is selected for the 2-column settings view
  const [selectedAgentSettings, setSelectedAgentSettings] = useState<
    string | null
  >(null);

  // Auto-select first agent
  useEffect(() => {
    if (!selectedAgentSettings && agents.length > 0) {
      const firstId = agents[0].accountId || agents[0].name || agents[0].id;
      setSelectedAgentSettings(firstId);
    }
  }, [agents, selectedAgentSettings]);
  // Track new-tag input per agent
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  // Track which agent model dropdowns are open
  const [openModelDropdown, setOpenModelDropdown] = useState<string | null>(
    null,
  );
  const [modelSearch, setModelSearch] = useState("");
  // Track which agents have the Add Model panel open
  const [showAddModel, setShowAddModel] = useState<Record<string, boolean>>({});
  const [showConfigureModel, setShowConfigureModel] = useState<Record<string, boolean>>({});

  // Fetch models on mount
  useEffect(() => {
    if (openClawConnected && modelCatalog.length === 0 && !isModelLoading) {
      fetchModels();
    }
  }, [openClawConnected, modelCatalog.length, isModelLoading, fetchModels]);

  // Fetch custom models on mount
  useEffect(() => {
    if (!customModelsFetched) {
      fetchCustomModels();
    }
  }, [customModelsFetched, fetchCustomModels]);

  // Merge custom models into catalog for dropdown
  const mergedCatalog = useMemo((): ModelCatalogEntry[] => {
    const customEntries: ModelCatalogEntry[] = customModels
      .filter((m) => m.isActive)
      .map((m) => ({
        ref: `${m.providerType}/${m.modelId}`,
        alias: m.displayName || m.modelId,
        provider: m.providerName || m.providerType,
        modelName: m.modelId,
      }));
    // Deduplicate: custom models take priority if same ref exists
    const existingRefs = new Set(customEntries.map((e) => e.ref));
    const openClawFiltered = modelCatalog.filter(
      (m) => !existingRefs.has(m.ref),
    );
    return [...customEntries, ...openClawFiltered];
  }, [customModels, modelCatalog]);

  // Removed toggleExpanded since we now use selectedAgentSettings

  const handleSave = useCallback(() => {
    setSaveStatus("Saved");
    setTimeout(() => setSaveStatus(null), 2000);
  }, []);

  const handleEmergencyShutdown = () => {
    if (!window.confirm("⚠ This will terminate all active agents. Continue?"))
      return;
    agents.forEach((agent: any) => {
      const id = agent.accountId || agent.name || agent.id;
      sendConfigUpdate(id, { shutdown: true });
    });
  };

  const handleAddTag = (agentId: string) => {
    const val = (tagInputs[agentId] || "").trim();
    if (!val) return;
    addTagToAgent(agentId, val);
    setTagInputs((prev) => ({ ...prev, [agentId]: "" }));
  };

  const handleCoreFiles = (agentId: string) => {
    setActiveTab("core-files");
    setTargetAgent(agentId);
    router.push("/dashboard/capabilities");
  };

  // Tag color palette — elegant, non-cyberpunk pastel/modern colors
  const TAG_COLORS = [
    {
      bg: "rgba(167,139,250,0.15)",
      text: "#c4b5fd",
      border: "rgba(167,139,250,0.3)",
    },
    {
      bg: "rgba(52,211,153,0.15)",
      text: "#6ee7b7",
      border: "rgba(52,211,153,0.3)",
    },
    {
      bg: "rgba(251,146,60,0.15)",
      text: "#fdba74",
      border: "rgba(251,146,60,0.3)",
    },
    {
      bg: "rgba(56,189,248,0.15)",
      text: "#7dd3fc",
      border: "rgba(56,189,248,0.3)",
    },
    {
      bg: "rgba(251,113,133,0.15)",
      text: "#fda4af",
      border: "rgba(251,113,133,0.3)",
    },
    {
      bg: "rgba(163,230,53,0.15)",
      text: "#bef264",
      border: "rgba(163,230,53,0.3)",
    },
    {
      bg: "rgba(232,121,249,0.15)",
      text: "#e879f9",
      border: "rgba(232,121,249,0.3)",
    },
    {
      bg: "rgba(253,224,71,0.15)",
      text: "#fde047",
      border: "rgba(253,224,71,0.3)",
    },
  ];

  const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  };

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        {saveStatus && (
          <span className="text-xs text-emerald-500 animate-pulse">
            {saveStatus}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 pb-6">
          {/* Connection Profiles */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Server className="w-3.5 h-3.5" /> Connection Profiles
            </h2>
            <ConnectionProfiles />
          </section>

          <Separator className="bg-border" />

          {/* Plugin Integration */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Puzzle className="w-3.5 h-3.5" /> Plugin Integration
            </h2>
            <PluginInstall />
          </section>

          <Separator className="bg-border" />

          {/* Agent Preferences (replaces old Agent Configuration + Displayed Agents) */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" /> Agent Preferences
            </h2>

            {agents.length === 0 ? (
              <div className="p-4 text-center">
                <Cpu className="w-6 h-6 text-muted-foreground/20 mx-auto mb-1" />
                <p className="text-[11px] text-muted-foreground/50">
                  No agents available.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[280px_1fr] gap-4 min-h-[420px]">
                {/* Left Column: Agent List */}
                <div className="space-y-1.5 h-[550px] overflow-y-auto pr-2">
                  {/* Add New Agent Button */}
                  <Button
                    onClick={() => {
                      // placeholder for future implementation
                    }}
                    variant="outline"
                    size="sm"
                    className="rounded-md h-8 text-xs gap-1.5 border-dashed border-border/40 text-muted-foreground hover:text-foreground w-full"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Agent
                  </Button>
                  {agents.map((a: any) => {
                    const id = a.accountId || a.name || a.id;
                    const label = a.accountId
                      ? a.accountId.charAt(0).toUpperCase() +
                        a.accountId.slice(1)
                      : a.name || a.id;
                    const isHidden = hiddenAgentIds.includes(id);
                    const isSelected = selectedAgentSettings === id;
                    const tags = agentTags[id] || [];
                    const profile = getAgentProfile(id);
                    const colorHex = profile?.colorHex || "#FF6D29";

                    return (
                      <div
                        key={id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAgentSettings(id)}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter' || e.key === ' ') {
                               e.preventDefault();
                               setSelectedAgentSettings(id);
                           }
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-md border transition-all duration-150 group block cursor-pointer outline-none",
                          isSelected
                            ? "border-emerald-500/30 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20"
                            : "border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/60 focus-visible:ring-1 focus-visible:ring-emerald-500/30",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: colorHex }}
                            />
                            <span className="text-sm font-medium text-foreground truncate">
                              {label}
                            </span>
                          </div>

                          {/* Show/Hide Toggle */}
                          <div
                            className="flex items-center gap-2 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center p-1.5 rounded bg-muted/20 text-muted-foreground/60 transition-colors group-hover:bg-muted/40 pointer-events-none">
                              {isHidden ? (
                                <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </div>
                            <Switch
                              checked={!isHidden}
                              onCheckedChange={(checked) =>
                                setAgentVisibility(id, !checked)
                              }
                            />
                          </div>
                        </div>

                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 pl-[18px]">
                            {tags.slice(0, 3).map((tag) => {
                              const c = getTagColor(tag);
                              return (
                                <span
                                  key={tag}
                                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-md leading-none"
                                  style={{
                                    background: c.bg,
                                    color: c.text,
                                    border: `1px solid ${c.border}`,
                                  }}
                                >
                                  {tag}
                                </span>
                              );
                            })}
                            {tags.length > 3 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right Column: Selected Agent Settings */}
                <Card className="rounded-md border-border/40 bg-card/30 shadow-none overflow-y-auto h-[550px] relative py-0 gap-0 block">
                  {selectedAgentSettings ? (
                    (() => {
                      const agent = agents.find(
                        (a: any) =>
                          (a.accountId || a.name || a.id) ===
                          selectedAgentSettings,
                      );
                      if (!agent) return null;

                      const id = selectedAgentSettings;
                      const tags = agentTags[id] || [];
                      const profile = getAgentProfile(id);
                      const colorHex = profile?.colorHex || "#FF6D29";

                      return (
                        <div className="space-y-4 p-4">
                          {/* Tags Section */}
                          <div className="space-y-3">
                            <label className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-medium">
                              <Tag className="w-3 h-3" /> Custom Tags
                            </label>

                            {/* Existing Tags */}
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {tags.map((tag) => {
                                  const c = getTagColor(tag);
                                  return (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-md transition-all duration-200"
                                      style={{
                                        background: c.bg,
                                        color: c.text,
                                        border: `1px solid ${c.border}`,
                                      }}
                                    >
                                      {tag}
                                      <button
                                        onClick={() =>
                                          removeTagFromAgent(id, tag)
                                        }
                                        className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Add Tag Input */}
                            <div className="flex gap-2 max-w-sm">
                              <Input
                                value={tagInputs[id] || ""}
                                onChange={(e) =>
                                  setTagInputs((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddTag(id);
                                  }
                                }}
                                placeholder="Add a tag..."
                                className="h-8 text-[12px] rounded-lg border-border bg-background flex-1"
                              />
                              <Button
                                onClick={() => handleAddTag(id)}
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 rounded-lg text-[11px] border-border gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add
                              </Button>
                            </div>
                          </div>

                          <Separator className="bg-border/50" />

                          {/* Action Buttons Row: Configure Model + Add Custom Model Provider */}
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              onClick={() =>
                                setShowConfigureModel((prev) => ({
                                  ...prev,
                                  [id]: !prev[id],
                                }))
                              }
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-md text-[11px] border-dashed border-border gap-1.5 justify-center hover:bg-amber-500/5 hover:border-amber-500/30 hover:text-amber-400 transition-all"
                            >
                              <Settings2 className="w-3 h-3" />
                              Configure Model
                            </Button>
                            <Button
                              onClick={() =>
                                setShowAddModel((prev) => ({
                                  ...prev,
                                  [id]: !prev[id],
                                }))
                              }
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-md text-[11px] border-dashed border-border gap-1.5 justify-center hover:bg-emerald-500/5 hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              Add Custom Model Provider
                            </Button>
                          </div>

                          {/* Configure Model Dialog */}
                          {showConfigureModel[id] && (
                            <ConfigureModelDialog
                              onClose={() =>
                                setShowConfigureModel((prev) => ({
                                  ...prev,
                                  [id]: false,
                                }))
                              }
                            />
                          )}

                          {/* Add Model Dialog (Modal version) */}
                          {showAddModel[id] && (
                            <AddModelDialog
                              onClose={() =>
                                setShowAddModel((prev) => ({
                                  ...prev,
                                  [id]: false,
                                }))
                              }
                            />
                          )}

                          {/* Model Selectors — Two Column: Agent Mode | Companion Mode */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Left Column: Agent Mode */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 pb-1 border-b border-border/30 mb-2">
                                <Cpu className="w-3.5 h-3.5 text-orange-400" />
                                <span className="text-[11px] uppercase tracking-widest text-orange-400/80 font-semibold">Agent Mode</span>
                              </div>
                              {AGENT_MODEL_ROLES.map(({ role, label, description }) => {
                              const roleIcon =
                                role === "primary" ? (
                                  <Cpu className="w-3 h-3" />
                                ) : role === "heartbeat" ? (
                                  <Heart className="w-3 h-3" />
                                ) : role === "tool_call" ? (
                                  <Wrench className="w-3 h-3" />
                                ) : role === "coding" ? (
                                  <Code2 className="w-3 h-3" />
                                ) : (
                                  <ShieldAlert className="w-3 h-3" />
                                );

                              const dropdownKey = `${id}-${role}`;
                              const pendingChange = pendingChanges.get(`${id}:${role}`);
                              const currentForRole =
                                pendingChange?.modelRef ??
                                activeModelsByRole[role]?.[id] ??
                                modelDefaults[role] ??
                                "";
                              const isDefault = pendingChange ? pendingChange.isDefault : (
                                !activeModelsByRole[role]?.[id] ||
                                activeModelsByRole[role]?.[id] === modelDefaults[role]
                              );

                              return (
                                <SettingsModelDropdown
                                  key={dropdownKey}
                                  label={label}
                                  icon={roleIcon}
                                  agentId={id}
                                  currentModel={currentForRole}
                                  modelCatalog={mergedCatalog}
                                  colorHex={colorHex}
                                  isOpen={openModelDropdown === dropdownKey}
                                  onToggle={() => {
                                    setOpenModelDropdown(openModelDropdown === dropdownKey ? null : dropdownKey);
                                    setModelSearch("");
                                  }}
                                  onClose={() => { setOpenModelDropdown(null); setModelSearch(""); }}
                                  search={openModelDropdown === dropdownKey ? modelSearch : ""}
                                  onSearchChange={setModelSearch}
                                  onSelect={(ref) => {
                                    bufferChange(id, role, ref, isDefault);
                                    setOpenModelDropdown(null);
                                    setModelSearch("");
                                  }}
                                  isConnected={openClawConnected}
                                  customModels={customModels}
                                  onDeleteCustomModel={removeCustomModel}
                                  subtitle={description}
                                />
                              );
                              })}
                            </div>

                            {/* Right Column: Companion Mode */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 pb-1 border-b border-pink-500/20 mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                                <span className="text-[11px] uppercase tracking-widest text-pink-400/80 font-semibold">Companion Mode</span>
                              </div>
                              {COMPANION_MODEL_ROLES.map(({ role, label, description }) => {
                              const roleIcon =
                                role === "companion_chat" ? (
                                  <Sparkles className="w-3 h-3" />
                                ) : role === "companion_coding" ? (
                                  <Code2 className="w-3 h-3" />
                                ) : role === "companion_tool_call" ? (
                                  <Wrench className="w-3 h-3" />
                                ) : role === "companion_function_call" ? (
                                  <Zap className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                );

                              const dropdownKey = `${id}-${role}`;
                              const pendingChange = pendingChanges.get(`${id}:${role}`);
                              const currentForRole =
                                pendingChange?.modelRef ??
                                activeModelsByRole[role]?.[id] ??
                                modelDefaults[role] ??
                                "";
                              const isDefault = pendingChange ? pendingChange.isDefault : (
                                !activeModelsByRole[role]?.[id] ||
                                activeModelsByRole[role]?.[id] === modelDefaults[role]
                              );

                              return (
                                <SettingsModelDropdown
                                  key={dropdownKey}
                                  label={label}
                                  icon={roleIcon}
                                  agentId={id}
                                  currentModel={currentForRole}
                                  modelCatalog={mergedCatalog}
                                  colorHex={"#ec4899"}
                                  isOpen={openModelDropdown === dropdownKey}
                                  onToggle={() => {
                                    setOpenModelDropdown(openModelDropdown === dropdownKey ? null : dropdownKey);
                                    setModelSearch("");
                                  }}
                                  onClose={() => { setOpenModelDropdown(null); setModelSearch(""); }}
                                  search={openModelDropdown === dropdownKey ? modelSearch : ""}
                                  onSearchChange={setModelSearch}
                                  onSelect={(ref) => {
                                    bufferChange(id, role, ref, isDefault);
                                    setOpenModelDropdown(null);
                                    setModelSearch("");
                                  }}
                                  isConnected={openClawConnected}
                                  customModels={customModels}
                                  onDeleteCustomModel={removeCustomModel}
                                  subtitle={description}
                                />
                              );
                              })}
                            </div>
                          </div>

                          <Separator className="bg-border/50" />

                          {/* Core Files Button */}
                          <div>
                            <label className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-medium mb-3">
                              <FolderCode className="w-3 h-3" /> Tools &
                              Configurations
                            </label>
                            <Button
                              onClick={() => handleCoreFiles(id)}
                              variant="outline"
                              size="sm"
                              className="w-full h-9 justify-start rounded-lg text-[11px] border-border gap-2 hover:bg-muted/40"
                            >
                              View Capabilities & Core Files
                            </Button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground space-y-2 relative h-full w-full">
                      <Cpu className="w-8 h-8 opacity-20" />
                      <p className="text-xs font-mono">
                        Select an agent to configure
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </section>

          <Separator className="bg-border" />

          {/* Preferences */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" /> Preferences
            </h2>

            <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      Auto-Restart Agents
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically restart agents after crash
                    </p>
                  </div>
                  <Switch
                    checked={autoRestart}
                    onCheckedChange={setAutoRestart}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      Error Notifications
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Get notified when agents encounter errors
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnError}
                    onCheckedChange={setNotifyOnError}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator className="bg-border" />

          {/* Danger Zone */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Danger Zone
            </h2>

            <Card className="rounded-md border-red-500/20 bg-red-500/5 shadow-none py-0 gap-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Emergency Shutdown
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Terminate all active agents immediately
                    </p>
                  </div>
                  <Button
                    onClick={handleEmergencyShutdown}
                    variant="outline"
                    size="sm"
                    className="rounded-full h-8 px-4 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                  >
                    Shutdown All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </ScrollArea>

      {/* ─── Sticky Apply & Restart Bar ─────────────────────────────── */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="sticky bottom-6 z-40 px-5 pointer-events-none flex items-center justify-between"
          >
            <div className="flex items-center gap-2 pointer-events-auto rounded-md px-3 py-1.5" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}>
                <div className="flex items-center gap-2 bg-card rounded-md px-3 py-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[12px] text-muted-foreground mr-1">
                    <span className="text-amber-400 font-medium">
                      {pendingChanges.size}
                    </span>{" "}
                    unsaved model{" "}
                    {pendingChanges.size === 1 ? "change" : "changes"}
                  </span>
                </div>
            </div>
            
            <div className="flex items-center gap-3 pointer-events-auto" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}>
                <Button
                  onClick={discardAllChanges}
                  variant="outline"
                  size="sm"
                  disabled={isApplying}
                  className="h-8 px-4 rounded-md text-[11px] border-border bg-card"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await applyAllChanges();
                    setSaveStatus("Model configuration applied");
                    setTimeout(() => setSaveStatus(null), 3000);
                  }}
                  size="sm"
                  disabled={isApplying}
                  className="h-8 px-5 rounded-md text-[11px] bg-orange-500 text-white hover:bg-orange-600 gap-1.5"
                >
                  {isApplying ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Apply & Restart OpenClaw
                </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Inline Model Dropdown for Settings (Portal-based) ──────────────────
import type { CustomModel } from "@/stores/useCustomModelStore";

interface SettingsModelDropdownProps {
  label: string;
  icon: React.ReactNode;
  agentId: string;
  currentModel: string;
  modelCatalog: {
    ref: string;
    alias?: string;
    provider: string;
    modelName: string;
  }[];
  colorHex: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  onSelect: (ref: string) => void;
  isConnected: boolean;
  customModels?: CustomModel[];
  onDeleteCustomModel?: (id: string) => Promise<void>;
  subtitle?: string;
}

function SettingsModelDropdown({
  label,
  icon,
  agentId,
  currentModel,
  modelCatalog,
  colorHex,
  isOpen,
  onToggle,
  onClose,
  search,
  onSearchChange,
  onSelect,
  isConnected,
  customModels,
  onDeleteCustomModel,
  subtitle,
}: SettingsModelDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const parts = currentModel
    ? (() => {
        const idx = currentModel.indexOf("/");
        if (idx > -1)
          return {
            provider: currentModel.substring(0, idx),
            name: currentModel.substring(idx + 1),
          };
        return { provider: "", name: currentModel };
      })()
    : null;

  const filtered = search.trim()
    ? modelCatalog.filter(
        (m) =>
          m.ref.toLowerCase().includes(search.toLowerCase()) ||
          (m.alias && m.alias.toLowerCase().includes(search.toLowerCase())) ||
          m.provider.toLowerCase().includes(search.toLowerCase()) ||
          m.modelName.toLowerCase().includes(search.toLowerCase()),
      )
    : modelCatalog;

  // Position the portal dropdown based on trigger rect
  const updatePos = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePos();
      window.addEventListener("scroll", updatePos, true);
      window.addEventListener("resize", updatePos);
      return () => {
        window.removeEventListener("scroll", updatePos, true);
        window.removeEventListener("resize", updatePos);
      };
    }
  }, [isOpen, updatePos]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  const portal =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[9999] rounded-lg border border-border bg-popover shadow-2xl overflow-hidden"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {/* Search */}
              <div className="p-2 border-b border-border">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                  <Search
                    size={12}
                    className="text-muted-foreground shrink-0"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search models..."
                    autoFocus
                    className="bg-transparent outline-none text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 w-full"
                  />
                </div>
              </div>

              {/* List */}
              <div className="max-h-48 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">
                    No models found
                  </div>
                ) : (
                  filtered.map((model) => {
                    const isActive = model.ref === currentModel;
                    // Check if this is a custom model
                    const customMatch = customModels?.find(
                      (cm) => `${cm.providerType}/${cm.modelId}` === model.ref,
                    );
                    return (
                      <div
                        key={model.ref}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-mono group/item cursor-pointer",
                          "hover:bg-emerald-500/10 hover:border-l-2 hover:border-l-emerald-500 transition-all duration-100",
                          isActive ? "bg-muted/30 border-l-2 border-l-emerald-500/50" : "border-l-2 border-l-transparent",
                        )}
                      >
                        <button
                          onClick={() => onSelect(model.ref)}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              isActive
                                ? "bg-foreground"
                                : "bg-muted-foreground/30",
                            )}
                          />
                          <span className="flex flex-col min-w-0">
                            <span className="flex items-center gap-0.5 truncate">
                              <span className="text-muted-foreground">
                                {model.provider}/
                              </span>
                              <span
                                className={
                                  isActive
                                    ? "text-foreground font-semibold"
                                    : "text-foreground/80"
                                }
                              >
                                {model.modelName}
                              </span>
                              {customMatch && (
                                <span
                                  className="ml-1 text-[9px] text-emerald-400/70 font-sans"
                                  title="Custom model"
                                >
                                  ★
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1.5">
                              {model.alias && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {model.alias}
                                </span>
                              )}
                              {customMatch?.maskedKey && (
                                <span className="text-[9px] text-muted-foreground/50 font-sans">
                                  {customMatch.maskedKey}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                        {customMatch && onDeleteCustomModel && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCustomModel(customMatch.id);
                            }}
                            className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground/40 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100"
                            title="Remove custom model"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
        {icon} {label}
        {subtitle && (
          <span className="text-muted-foreground/40 font-normal">
            — {subtitle}
          </span>
        )}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={onToggle}
          disabled={!isConnected}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] font-mono transition-all group",
            "border bg-background hover:border-emerald-500/50 hover:bg-card/50 ring-offset-background cursor-pointer",
            isOpen ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-border",
            !isConnected && "opacity-40 cursor-not-allowed",
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="shrink-0" style={{ color: colorHex }}>
              {icon}
            </span>
            {parts ? (
              <>
                <span className="truncate">
                  <span className="text-muted-foreground">{parts.provider}/</span>
                  <span className="text-foreground">{parts.name}</span>
                </span>
                {(() => {
                  const cm = customModels?.find(
                    (c) => `${c.providerType}/${c.modelId}` === currentModel
                  );
                  return cm?.maskedKey ? (
                    <span className="text-[9px] text-muted-foreground/50 font-sans ml-1 shrink-0">
                      {cm.maskedKey}
                    </span>
                  ) : null;
                })()}
              </>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </span>
          <ChevronDown
            size={12}
            className={cn(
              "text-muted-foreground transition-transform shrink-0",
              isOpen && "rotate-180",
            )}
          />
        </button>
        {portal}
      </div>
    </div>
  );
}
