
import { parseDate } from './utils.js';

export function computeSearchState(criteria, matches, allData) {
    if (!criteria) {
        return {
            active: false,
            criteria: null,
            matches: [],
            zoomRange: null
        };
    }

    // Calculate Collapsed/Hidden Groups based on Matches
    const collapsedGroups = new Set();
    const hiddenLevel1s = new Set();

    if (criteria) {
        // 1. Identify "Matched" L0s and L1s
        const matchedL0s = new Set();
        const matchedL1s = new Set();

        matches.forEach(m => {
            if (m.level0) matchedL0s.add(m.level0);
            if (m.level0 && m.level1) matchedL1s.add(`${m.level0}|${m.level1}`);
        });

        // 2. Identify "All" L0s and L1s to find difference
        const data = allData || [];
        data.forEach(d => {
            const l0 = d.level0;
            const l1 = d.level1;

            // Collapse L0 if not matched
            if (l0 && !matchedL0s.has(l0)) {
                collapsedGroups.add(l0);
            }

            // Hide L1 if not matched
            if (l0 && l1) {
                const key = `${l0}|${l1}`;
                if (!matchedL1s.has(key)) {
                    hiddenLevel1s.add(key);
                }
            }
        });
    }

    // Calculate zoom range from matches
    let zoomRange = null;
    if (matches.length > 0) {
        const start = d3.min(matches, d => parseDate(d.start));
        const end = d3.max(matches, d => d.end ? parseDate(d.end) : (d.start ? parseDate(d.start) : null));

        if (start && end) {
            let zoomStart = start;
            let zoomEnd = end;

            if (criteria.minDate && criteria.minDate > start) {
                zoomStart = criteria.minDate;
            }

            const span = zoomEnd - zoomStart;
            const pad = span * 0.02; // 2% padding

            let finalStart = new Date(zoomStart.getTime() - pad);
            let finalEnd = new Date(zoomEnd.getTime() + pad);

            if (criteria.minDate && finalStart < criteria.minDate) {
                finalStart = criteria.minDate;
            }

            zoomRange = [finalStart, finalEnd];
        }
    }

    return {
        active: true,
        criteria,
        matches,
        zoomRange,
        searchCollapsedGroups: Array.from(collapsedGroups),
        searchHiddenLevel1s: Array.from(hiddenLevel1s)
    };
}
