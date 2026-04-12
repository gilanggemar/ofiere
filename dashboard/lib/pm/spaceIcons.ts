/**
 * Shared mapping of space icon keys to Lucide icon components.
 * The `icon` field on PMSpace stores one of these string keys.
 */
import {
    Folder, Rocket, Briefcase, FlaskConical, Target,
    BarChart3, Wrench, Globe, Bot, Zap,
    type LucideIcon,
} from "lucide-react";

export const SPACE_ICON_MAP: Record<string, LucideIcon> = {
    folder: Folder,
    rocket: Rocket,
    briefcase: Briefcase,
    flask: FlaskConical,
    target: Target,
    chart: BarChart3,
    wrench: Wrench,
    globe: Globe,
    bot: Bot,
    zap: Zap,
};

/** Ordered list of icon keys for the picker UI */
export const SPACE_ICON_KEYS = Object.keys(SPACE_ICON_MAP);

/** Default icon key */
export const DEFAULT_SPACE_ICON = "folder";

/** Resolve a stored icon string to its Lucide component. Falls back to Folder. */
export function resolveSpaceIcon(iconKey: string | undefined | null): LucideIcon {
    if (!iconKey) return Folder;
    return SPACE_ICON_MAP[iconKey] ?? Folder;
}
