
export function calculateFocusCollapse(d, allData, activeStory) {
    // A. Collapse all OTHER Level 0 groups
    const allL0s = new Set(allData.map(item => item.level0).filter(Boolean));
    const collapsedGroups = [];
    allL0s.forEach(l0 => {
        if (l0 !== d.level0) {
            collapsedGroups.push(l0);
        }
    });

    // B. Collapse all OTHER Level 1 groups within the SAME Level 0
    const currentL1s = new Set(
        allData
            .filter(item => item.level0 === d.level0 && item.level1)
            .map(item => item.level1)
    );

    // Retrieve existing L1 collapse settings to preserve state of other groups
    let existingCollapsedL1s = (activeStory.settings && activeStory.settings.collapsedLevel1s) ? activeStory.settings.collapsedLevel1s : [];

    // Remove any existing entries for THIS Level 0 (reset state for this group)
    const prefix = `${d.level0}|`;
    let newCollapsedL1s = existingCollapsedL1s.filter(key => !key.startsWith(prefix));

    // Add all L1s in this L0 that describe groups OTHER than the event's own L1
    currentL1s.forEach(l1 => {
        if (!d.level1 || l1 !== d.level1) {
            newCollapsedL1s.push(`${d.level0}|${l1}`);
        }
    });

    return {
        collapsedGroups: collapsedGroups,
        collapsedLevel1s: newCollapsedL1s
    };
}
