import { parseDate } from './utils.js';

/**
 * Process timeline data to prepare it for rendering.
 * @param {Array} data - Original timeline data
 * @param {Array} collapsedGroups - Level 0 groups to collapse
 * @param {Array} groupOrder - Level 0 groups' manual order
 * @param {Array} collapsedLevel1s - Level 1 groups to collapse
 * @param {Array} hiddenLevel1s - Level 1 groups to hide
 * @returns {Array} Layout data prepared for rendering
 */
export function processTimelineData(data, collapsedGroups = [], groupOrder = [], collapsedLevel1s = [], hiddenLevel1s = []) {
    const events = data.map((d, i) => {
        const startDate = parseDate(d.start);
        const endDate = parseDate(d.end);
        const isEvent = false; // stop discerning between events and points  !endDate; // Event if no end date

        return {
            ...d,
            ...d,
            id: d.id || `gen-${i}`, // Use existing ID or generate one based on index
            startDate: startDate,
            // For point events, use 1 day duration for layout collision/overlap checks
            endDate: endDate || (startDate ? d3.timeDay.offset(startDate, 1) : null),
            isEvent: isEvent
        };
    }).filter(e => e.startDate instanceof Date && !isNaN(e.startDate));

    // Group by level0
    const groups = d3.group(events, d => d.level0);

    // Sort levels: groupOrder > Company > Alphabetical
    const sortedLevel0 = Array.from(groups.keys()).sort((a, b) => {
        const indexA = groupOrder.indexOf(a);
        const indexB = groupOrder.indexOf(b);

        // 1. If both are in the manual order list, respect that order
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }

        // 2. If only A is in list, it comes first
        if (indexA !== -1) return -1;

        // 3. If only B is in list, it comes first
        if (indexB !== -1) return 1;


        // 5. Fallback: Alphabetical
        return a.localeCompare(b);
    });

    const layout = [];

    sortedLevel0.forEach(level0 => {
        let allLevelItems = groups.get(level0);

        // Filter if collapsed (Level 0): FULLY COLLAPSE (Show no items)
        if (collapsedGroups.includes(level0)) {
            allLevelItems = [];
        } else {
            // Filter if Level 1 is collapsed or hidden
            allLevelItems = allLevelItems.filter(item => {
                if (!item.level1) return true;

                // Robust key generation
                const l0 = (item.level0 || "").trim();
                const l1 = (item.level1 || "").trim();
                const key = `${l0}|${l1}`;

                // Check Hidden (Strict remove)
                if (hiddenLevel1s.includes(key)) {
                    return false;
                }

                // Check Collapsed (Hide children/L2)
                if (collapsedLevel1s.includes(key)) {
                    // If L1 is collapsed, hide items that have Level 2 (children of L1)
                    // Treat whitespace-only level2 as "no level 2"
                    const hasLevel2 = item.level2 && String(item.level2).trim().length > 0;
                    return !hasLevel2;
                }
                return true;
            });
        }

        // 1. Group items by Level 1
        const level1Groups = d3.group(allLevelItems, d => d.level1 || " _misc_ "); // Group by L1

        // 2. Sort Level 1 Groups via their Start Date
        const sortedL1Keys = Array.from(level1Groups.keys()).sort((k1, k2) => {
            const items1 = level1Groups.get(k1);
            const items2 = level1Groups.get(k2);
            const min1 = d3.min(items1, d => d.startDate);
            const min2 = d3.min(items2, d => d.startDate);

            if (!min1) return 1;
            if (!min2) return -1;
            return min1 - min2;
        });

        let currentLevel0RowIndex = 0; // Tracks the Y-offset (in rows) for the entire L0 container

        const finalLevelEvents = [];
        const finalPointEvents = [];

        sortedL1Keys.forEach(l1Key => {
            const groupItems = level1Groups.get(l1Key);

            // Separate bars and points
            const groupBars = groupItems.filter(item => !item.isEvent);
            const groupPoints = groupItems.filter(item => item.isEvent);

            // Sort bars:
            // 1. "Parent" items (Level 2 is empty) come FIRST.
            // 2. Then by start date.
            groupBars.sort((a, b) => {
                const aIsParent = !a.level2 || a.level2.trim() === '';
                const bIsParent = !b.level2 || b.level2.trim() === '';

                if (aIsParent && !bIsParent) return -1; // A comes first
                if (!aIsParent && bIsParent) return 1;  // B comes first

                // Secondary sort: Start Date
                return a.startDate - b.startDate || (b.endDate - b.startDate) - (a.endDate - a.startDate);
            });

            // Pack bars into rows specific to this Level 1 block
            const blockRows = [];
            // Pack bars into rows specific to this Level 1 block
            // Iterate over all bars and position them in existing rows if possible
            // Otherwise, create a new row for them
            groupBars.forEach(event => {
                let placed = false;
                for (let i = 0; i < blockRows.length; i++) {
                    // Check if this event overlaps with any bar in the current row
                    // If it does not overlap, place it in this row
                    if (!overlapsWithRow(event, blockRows[i])) {
                        blockRows[i].push(event);
                        // Set the row index of the event to the current row index
                        event.rowIndex = currentLevel0RowIndex + i;
                        placed = true;
                        break;
                    }
                }
                // If no row was found to place the event in, create a new row
                if (!placed) {
                    event.rowIndex = currentLevel0RowIndex + blockRows.length;
                    // Add a new row with the event as the only element
                    blockRows.push([event]);
                }
            });

            // Position Point Events
            groupPoints.forEach(pointEvent => {
                pointEvent.rowIndex = currentLevel0RowIndex;

                const candidates = groupBars.filter(bar =>
                    (bar.level2 === pointEvent.level2) ||
                    (!bar.level2)
                );

                if (candidates.length > 0) {
                    // Try to find overlap first
                    const overlap = candidates.find(bar =>
                        pointEvent.startDate >= bar.startDate && pointEvent.startDate <= bar.endDate
                    );

                    if (overlap) {
                        pointEvent.rowIndex = overlap.rowIndex;
                    } else {
                        let closest = candidates[0];
                        let minDiff = Math.abs(pointEvent.startDate - closest.startDate);

                        for (let i = 1; i < candidates.length; i++) {
                            const diff = Math.abs(pointEvent.startDate - candidates[i].startDate);
                            if (diff < minDiff) {
                                minDiff = diff;
                                closest = candidates[i];
                            }
                        }
                        pointEvent.rowIndex = closest.rowIndex;
                    }
                }
            });

            finalLevelEvents.push(...groupBars);
            finalPointEvents.push(...groupPoints);

            // Increment offset by the height of this block
            let rowsUsed = blockRows.length;
            if (rowsUsed === 0 && groupPoints.length > 0) rowsUsed = 1; // Reserve space if points exist but no bars

            currentLevel0RowIndex += rowsUsed;
        });

        layout.push({
            level0,
            events: finalLevelEvents,
            pointEvents: finalPointEvents,
            rowCount: currentLevel0RowIndex,
            yOffset: 0,
            topBarY: 45
        });
    });

    return layout;
}

function overlapsWithRow(event, row) {
    return row.some(e => {
        // Events overlap if [start1, end1] intersects [start2, end2]
        return event.startDate < e.endDate && event.endDate > e.startDate;
    });
}
