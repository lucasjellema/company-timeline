import { CONFIG } from './config.js';
import { parseDate } from './utils.js';

export class SearchController {
    constructor(storage, onSearchUpdate) {
        this.storage = storage;
        this.onSearchUpdate = onSearchUpdate; // Callback to main.js: (criteria) => {}
        this.activeCriteria = null;
    }

    init() {
        this.loadEventTypes();
        this.bindEvents();
    }

    loadEventTypes() {
        const activeStory = this.storage.getActiveStory();
        if (!activeStory || !activeStory.data) return;

        const container = document.getElementById('search-types-container');
        if (!container) return;
        container.innerHTML = '';

        const types = new Set(activeStory.data.map(d => d.type));
        const sortedTypes = Array.from(types).sort();

        sortedTypes.forEach(type => {
            const id = `type-${type.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="${id}" value="${type}" name="event-type">
                <label for="${id}">${type}</label>
            `;
            container.appendChild(div);
        });
    }

    bindEvents() {
        const applyBtn = document.getElementById('apply-search-btn');
        const clearBtn = document.getElementById('clear-search-btn');

        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.handleSearch());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSearch());
        }

        const typeCollapsible = document.getElementById('event-types-collapsible');
        if (typeCollapsible) {
            const header = typeCollapsible.querySelector('.collapsible-header');
            if (header) {
                header.addEventListener('click', () => {
                    typeCollapsible.classList.toggle('collapsed');
                });
            }
        }
    }

    handleSearch() {
        // 1. Gather Criteria
        const keywords = document.getElementById('search-text').value.toLowerCase().trim();

        const typeCheckboxes = document.querySelectorAll('input[name="event-type"]:checked');
        const selectedTypes = Array.from(typeCheckboxes).map(cb => cb.value);

        const minDur = document.getElementById('search-min-duration').value;
        const maxDur = document.getElementById('search-max-duration').value;

        const minDateVal = document.getElementById('search-min-date').value;
        const maxDateVal = document.getElementById('search-max-date').value;

        const hideNonMatching = document.getElementById('search-hide-non-matching').checked;

        // 2. Validate empty search?
        // If all empty, it acts as a clear
        if (!keywords && selectedTypes.length === 0 && !minDur && !maxDur && !minDateVal && !maxDateVal) {
            this.clearSearch();
            return;
        }

        const criteria = {
            keywords,
            types: selectedTypes,
            minDuration: minDur ? parseInt(minDur) : null,
            maxDuration: maxDur ? parseInt(maxDur) : null,
            minDate: parseDate(minDateVal),
            maxDate: parseDate(maxDateVal),
            hideNonMatching
        };

        this.activeCriteria = criteria;

        // 3. Find Matches (logic here or in filter? Logic here is better to show stats immediately)
        const activeStory = this.storage.getActiveStory();
        const matches = this.findMatches(activeStory.data, criteria);

        // Update Stats
        this.updateStats(matches.length);

        // 4. Trigger Update
        if (this.onSearchUpdate) {
            this.onSearchUpdate(criteria, matches);
        }
    }

    findMatches(data, criteria) {
        if (!data) return [];

        return data.filter(d => {
            // Type Filter
            if (criteria.types.length > 0 && !criteria.types.includes(d.type)) {
                return false;
            }

            // Date Filter
            if (criteria.minDate || criteria.maxDate) {
                const start = parseDate(d.start);
                if (!start) return false; // Invalid start date in data

                const end = d.end ? parseDate(d.end) : start;

                // "from date": find events that end after this date (end >= minDate)
                if (criteria.minDate && end < criteria.minDate) {
                    return false;
                }

                // "until date": find events that start before that date (start <= maxDate)
                if (criteria.maxDate && start >= criteria.maxDate) {
                    return false;
                }
            }

            // Duration Filter
            if (criteria.minDuration !== null || criteria.maxDuration !== null) {
                const start = parseDate(d.start);
                // Point event duration = 0? Or skip? Assuming non-point for duration check usually.
                // Let's assume point events have 0 duration.
                let durationDays = 0;
                if (d.end) {
                    const end = parseDate(d.end);
                    if (start && end) {
                        const diffTime = Math.abs(end - start);
                        durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                }

                if (criteria.minDuration !== null && durationDays < criteria.minDuration) return false;
                if (criteria.maxDuration !== null && durationDays > criteria.maxDuration) return false;
            }

            // Keyword Filter
            if (criteria.keywords) {
                const term = criteria.keywords;
                const title = (d.title || "").toLowerCase();
                const desc = (d.description || "").toLowerCase();
                const l0 = (d.level0 || "").toLowerCase();
                const l1 = (d.level1 || "").toLowerCase();
                const l2 = (d.level2 || "").toLowerCase();

                if (!title.includes(term) &&
                    !desc.includes(term) &&
                    !l0.includes(term) &&
                    !l1.includes(term) &&
                    !l2.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }

    clearSearch() {
        document.getElementById('search-text').value = '';
        document.querySelectorAll('input[name="event-type"]:checked').forEach(cb => cb.checked = false);
        document.getElementById('search-min-duration').value = '';
        document.getElementById('search-max-duration').value = '';
        document.getElementById('search-min-date').value = '';
        document.getElementById('search-max-date').value = '';
        document.getElementById('search-hide-non-matching').checked = false;

        document.getElementById('search-results-stats').classList.add('hidden');

        this.activeCriteria = null;
        if (this.onSearchUpdate) {
            this.onSearchUpdate(null, []);
        }
    }

    updateStats(count) {
        const statsEl = document.getElementById('search-results-stats');
        const countEl = document.getElementById('search-match-count');
        if (statsEl && countEl) {
            countEl.textContent = count;
            statsEl.classList.remove('hidden');
        }
    }
}
