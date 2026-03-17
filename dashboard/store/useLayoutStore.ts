import { create } from 'zustand';

interface LayoutState {
    topRailWidth: number;
    setTopRailWidth: (width: number) => void;
    isTopRailExpanded: boolean;
    setTopRailExpanded: (expanded: boolean) => void;
    isBottomDockExpanded: boolean;
    setBottomDockExpanded: (expanded: boolean) => void;
    isTopRightExpanded: boolean;
    setTopRightExpanded: (expanded: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
    topRailWidth: 230, // Default starting width
    setTopRailWidth: (width) => set({ topRailWidth: width }),
    isTopRailExpanded: false,
    setTopRailExpanded: (expanded) => set({ isTopRailExpanded: expanded }),
    isBottomDockExpanded: false,
    setBottomDockExpanded: (expanded) => set({ isBottomDockExpanded: expanded }),
    isTopRightExpanded: false,
    setTopRightExpanded: (expanded) => set({ isTopRightExpanded: expanded }),
}));
