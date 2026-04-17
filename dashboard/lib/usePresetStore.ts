import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PresetType = 'budget' | 'stack' | 'legal' | 'deadline' | 'custom';

export interface PresetItem {
    id: string;
    type: PresetType;
    label: string;
}

interface PresetStore {
    goalPresets: PresetItem[];
    constraintPresets: PresetItem[];

    addGoalPreset: (type: PresetType, label: string) => void;
    removeGoalPreset: (id: string) => void;
    updateGoalPreset: (id: string, label: string) => void;
    resetGoalPresets: () => void;

    addConstraintPreset: (type: PresetType, label: string) => void;
    removeConstraintPreset: (id: string) => void;
    updateConstraintPreset: (id: string, label: string) => void;
    resetConstraintPresets: () => void;
}

const DEFAULT_GOAL_PRESETS: PresetItem[] = [
    { id: 'goal-budget',   type: 'budget',   label: 'Stay within budget' },
    { id: 'goal-stack',    type: 'stack',    label: 'Use specified tech stack' },
    { id: 'goal-legal',    type: 'legal',    label: 'Ensure legal compliance' },
    { id: 'goal-deadline', type: 'deadline', label: 'Meet the deadline' },
];

const DEFAULT_CONSTRAINT_PRESETS: PresetItem[] = [
    { id: 'cons-budget',   type: 'budget',   label: 'Max budget limit' },
    { id: 'cons-stack',    type: 'stack',    label: 'Must use approved stack' },
    { id: 'cons-legal',    type: 'legal',    label: 'No license violations' },
    { id: 'cons-deadline', type: 'deadline', label: 'Hard deadline required' },
];

export const usePresetStore = create<PresetStore>()(
    persist(
        (set) => ({
            goalPresets: DEFAULT_GOAL_PRESETS,
            constraintPresets: DEFAULT_CONSTRAINT_PRESETS,

            addGoalPreset: (type, label) =>
                set((state) => ({
                    goalPresets: [
                        ...state.goalPresets,
                        { id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, label },
                    ],
                })),

            removeGoalPreset: (id) =>
                set((state) => ({
                    goalPresets: state.goalPresets.filter((p) => p.id !== id),
                })),

            updateGoalPreset: (id, label) =>
                set((state) => ({
                    goalPresets: state.goalPresets.map((p) =>
                        p.id === id ? { ...p, label } : p
                    ),
                })),

            resetGoalPresets: () => set({ goalPresets: DEFAULT_GOAL_PRESETS }),

            addConstraintPreset: (type, label) =>
                set((state) => ({
                    constraintPresets: [
                        ...state.constraintPresets,
                        { id: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, label },
                    ],
                })),

            removeConstraintPreset: (id) =>
                set((state) => ({
                    constraintPresets: state.constraintPresets.filter((p) => p.id !== id),
                })),

            updateConstraintPreset: (id, label) =>
                set((state) => ({
                    constraintPresets: state.constraintPresets.map((p) =>
                        p.id === id ? { ...p, label } : p
                    ),
                })),

            resetConstraintPresets: () => set({ constraintPresets: DEFAULT_CONSTRAINT_PRESETS }),
        }),
        {
            name: 'ofiere-preset-store',
        }
    )
);
