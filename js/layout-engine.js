import { parseDate } from './utils.js';

export function processTimelineData(data, collapsedGroups = [], groupOrder = []) {
    const events = data.map((d, i) => {
        const startDate = parseDate(d.start);
        const endDate = parseDate(d.end);
        const isEvent = !endDate; // Event if no end date

        return {
            ...d,
            id: i,
            startDate: startDate,
            // For point events, use 1 day duration for layout collision/overlap checks
            endDate: endDate || d3.timeDay.offset(startDate, 1),
            isEvent: isEvent
        };
    });

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

        // 4. Fallback: "Company" at top (if not manually ordered)
        if (a.toLowerCase() === 'company') return -1;
        if (b.toLowerCase() === 'company') return 1;

        // 5. Fallback: Alphabetical
        return a.localeCompare(b);
    });

    const layout = [];
    let currentYOffset = 0;

    sortedLevel0.forEach(level0 => {
        let allLevelItems = groups.get(level0);

        // Filter if collapsed: Keep only items WITHOUT level1 (top-level items)
        if (collapsedGroups.includes(level0)) {
            allLevelItems = allLevelItems.filter(item => !item.level1);
        }

        // Separate events from regular timeline items
        const levelEvents = allLevelItems.filter(item => !item.isEvent);
        const levelPointEvents = allLevelItems.filter(item => item.isEvent);

        // Sort regular events by start date, then duration (desc)
        levelEvents.sort((a, b) => a.startDate - b.startDate || (b.endDate - b.startDate) - (a.endDate - a.startDate));

        const rows = []; // array of arrays (events in each row)

        // Only layout regular events in rows
        levelEvents.forEach(event => {
            let placed = false;
            for (let i = 0; i < rows.length; i++) {
                if (!overlapsWithRow(event, rows[i])) {
                    rows[i].push(event);
                    event.rowIndex = i;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                event.rowIndex = rows.length;
                rows.push([event]);
            }
        });

        // Force all point events to be on the top row (visually above)
        // Update: Try to attach to a related bar (same level1, level2)
        levelPointEvents.forEach(pointEvent => {
            // Default to top if no match
            pointEvent.rowIndex = 0;

            const candidates = levelEvents.filter(bar =>
                bar.level1 === pointEvent.level1 &&
                bar.level2 === pointEvent.level2
            );

            if (candidates.length > 0) {
                // 1. Try to find overlapping bar
                const overlap = candidates.find(bar =>
                    pointEvent.startDate >= bar.startDate && pointEvent.startDate <= bar.endDate
                );

                if (overlap) {
                    pointEvent.rowIndex = overlap.rowIndex;
                } else {
                    // 2. If no overlap, find closest bar by start date distance
                    // (Useful for kickoffs slightly before, or wrap-ups slightly after)
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

        layout.push({
            level0,
            events: levelEvents,
            pointEvents: levelPointEvents,
            rowCount: rows.length, // Allow 0 rows if empty
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
