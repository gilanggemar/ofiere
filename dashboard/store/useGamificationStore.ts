import { create } from 'zustand';

interface AgentXPData {
    agentId: string;
    totalXp: number;
    level: number;
    xpToNextLevel: number;
    rank: string;
}

interface DailyMission {
    id: string;
    date: string;
    title: string;
    type: string;
    target: number;
    current: number;
    xpReward: number;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    isCompleted: boolean | number; // SQLite might return 0/1 depending on parser OR boolean
}

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    xpReward: number;
    rarity: string;
    unlockedAt?: string;
    agentId?: string;
}

interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
    streakHistory: string; // JSON
}

interface GamificationState {
    agentXP: Record<string, AgentXPData>;
    fleetPowerScore: number;
    dailyMissions: DailyMission[];
    allMissionsCompleted: boolean;
    unlockedAchievements: Achievement[];
    lockedAchievements: Achievement[];
    recentUnlock: Achievement | null;
    currentStreak: number;
    longestStreak: number;
    streakHistory: { date: string; active: boolean }[];

    fetchAll: () => Promise<void>;
    awardXP: (agentId: string, amount: number, reason: string, sourceId?: string) => Promise<void>;
    refreshMissions: () => Promise<void>;
    updateMissionProgress: (type: string, increment?: number) => Promise<void>;
    checkStreak: () => Promise<void>;
    dismissRecentUnlock: () => void;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
    agentXP: {},
    fleetPowerScore: 0,
    dailyMissions: [],
    allMissionsCompleted: false,
    unlockedAchievements: [],
    lockedAchievements: [],
    recentUnlock: null,
    currentStreak: 0,
    longestStreak: 0,
    streakHistory: [],

    fetchAll: async () => {
        try {
            const fetchJson = async (url: string, init?: RequestInit) => {
                const res = await fetch(url, init);
                if (!res.ok) {
                    // 401/404 are expected on first load (auth not ready, or no data yet)
                    if (res.status === 401 || res.status === 404) {
                        return {};
                    }
                    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
                }
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return res.json();
                }
                return {};
            };

            const [xpRes, missionsRes, achRes, streakRes] = await Promise.all([
                fetchJson('/api/gamification/xp'),
                fetchJson('/api/gamification/missions'),
                fetchJson('/api/gamification/achievements'),
                fetchJson('/api/gamification/streak/check', { method: 'POST' }).catch(() => ({}))
            ].map(p => p.catch(() => ({}))));

            const xpMap: Record<string, AgentXPData> = {};
            if (xpRes.agents) {
                xpRes.agents.forEach((a: any) => {
                    const id = a.agent_id || a.agentId || '';
                    xpMap[id] = {
                        agentId: id,
                        totalXp: a.total_xp ?? a.totalXp ?? 0,
                        level: a.level ?? 1,
                        xpToNextLevel: a.xp_to_next_level ?? a.xpToNextLevel ?? 100,
                        rank: a.rank ?? 'INITIATE',
                    };
                });
            }

            set({
                agentXP: xpMap,
                fleetPowerScore: xpRes.fleetPowerScore || 0,
                dailyMissions: missionsRes.missions || [],
                allMissionsCompleted: missionsRes.allCompleted || false,
                unlockedAchievements: achRes.unlocked || [],
                lockedAchievements: achRes.locked || [],
                currentStreak: streakRes.currentStreak || 0,
                longestStreak: streakRes.longestStreak || 0,
                streakHistory: streakRes.streakHistory ? JSON.parse(streakRes.streakHistory) : [],
            });
        } catch (e) {
            console.error("Failed to load gamification data", e);
        }
    },

    awardXP: async (agentId, amount, reason, sourceId) => {
        try {
            await fetch('/api/gamification/xp/award', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId, amount, reason, sourceId })
            });
            get().fetchAll(); // Re-sync state
        } catch (e) {
            console.error(e);
        }
    },

    refreshMissions: async () => {
        try {
            const res = await fetch('/api/gamification/missions');
            if (!res.ok) return;
            const data = await res.json();
            set({
                dailyMissions: data.missions || [],
                allMissionsCompleted: data.allCompleted || false,
            });
        } catch (e) {
            console.error(e);
        }
    },

    updateMissionProgress: async (type, increment = 1) => {
        try {
            await fetch('/api/gamification/missions/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, increment })
            });
            get().refreshMissions();
            // Need to re-fetch XP and achievements inside refresh theoretically, but let's just do fetchAll
            get().fetchAll();
        } catch (e) {
            console.error(e);
        }
    },

    checkStreak: async () => {
        try {
            await fetch('/api/gamification/streak/check', { method: 'POST' });
            get().fetchAll();
        } catch (e) {
            console.error(e);
        }
    },

    dismissRecentUnlock: () => set({ recentUnlock: null })
}));
