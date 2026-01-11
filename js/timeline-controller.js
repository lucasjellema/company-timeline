
import { CONFIG } from './config.js';
import { parseDate, formatMonthYearFriendly, formatDateFriendly } from './utils.js';
import { processTimelineData } from './layout-engine.js';
import { SearchController } from './search-controller.js';
import { computeSearchState } from './search-logic.js';
import { TimelineContextMenu } from './timeline-context-menu.js';
import { calculateFocusCollapse } from './interaction-logic.js';

export class TimelineController {
    constructor(renderer, storage, mapManager, galleryManager) {
        this.renderer = renderer;
        this.storage = storage;
        this.mapManager = mapManager;
        this.galleryManager = galleryManager;

        this.activeL0Category = null;
        this.searchState = {
            active: false,
            criteria: null,
            matches: [],
            zoomRange: null
        };

        this.lastFocusedEventId = null;
        this.contextMenu = new TimelineContextMenu(storage, () => this.renderTimeline({ preserveSlider: true }));

        this.searchController = new SearchController(storage, this.handleSearchUpdate.bind(this));

        // Bind renderer interactions
        this.bindRendererEvents();
    }

    init() {
        this.searchController.init();
    }

    handleSearchUpdate(criteria, matches) {
        if (!criteria) {
            this.searchState = { active: false, criteria: null, matches: [], zoomRange: null };
            this.renderTimeline({ preserveSlider: true });
            return;
        }

        const allData = window.timelineData || [];
        this.searchState = computeSearchState(criteria, matches, allData);

        this.renderTimeline({ preserveSlider: true, domain: this.searchState.zoomRange });
        this.updateMapAndGallery(this.searchState.matches);
    }

    updateMapAndGallery(events) {
        this.mapManager.clearMarkers();
        const boundsPoints = [];

        const activeStory = this.storage.getActiveStory();
        const typeIcons = (activeStory?.settings?.icons) || {};
        const typeColors = (activeStory?.settings?.colors) || {};

        events.forEach(d => {
            const pt = this.mapManager.addEventPin(d, false, {
                onHover: (id) => this.renderer.highlightEvent(id),
                onBlur: (id) => this.renderer.unhighlightEvent(id)
            }, typeIcons, typeColors);
            if (pt) boundsPoints.push(pt);
        });

        if (boundsPoints.length > 0 && this.renderer.isMapPanelOpen) {
            this.mapManager.fitBounds(boundsPoints);
        }

        this.galleryManager.update(events);
    }

    renderTimeline(options = {}) {
        const preserveSlider = options.preserveSlider || false;
        let dataToProcess = window.timelineData || [];

        // Filters
        if (this.activeL0Category) {
            dataToProcess = dataToProcess.filter(d => d.level0 === this.activeL0Category);
            if (dataToProcess.length === 0) {
                this.activeL0Category = null;
                dataToProcess = window.timelineData;
            }
        }

        if (this.searchState.active && this.searchState.criteria.hideNonMatching) {
            const matchIds = new Set(this.searchState.matches.map(d => d.id));
            dataToProcess = dataToProcess.filter(d => matchIds.has(d.id));
        }

        // Configs
        const activeStory = this.storage.getActiveStory();
        let customDomain = options.domain || null;
        let mergedColors = CONFIG.TYPE_COLORS;
        let mergedIcons = {};
        let collapsedGroups = [];
        let groupOrder = [];
        let collapsedLevel1s = [];
        let hiddenLevel1s = [];

        if (this.searchState.active) {
            if (this.searchState.searchCollapsedGroups) collapsedGroups = [...this.searchState.searchCollapsedGroups];
            if (this.searchState.searchHiddenLevel1s) hiddenLevel1s = [...this.searchState.searchHiddenLevel1s];
        }

        if (activeStory) {
            this.updateHeader(activeStory);
            if (!customDomain && activeStory.startDate && activeStory.endDate) {
                const s = parseDate(activeStory.startDate);
                const e = parseDate(activeStory.endDate);
                if (s && e) customDomain = [s, e];
            }
            if (activeStory.settings) {
                if (activeStory.settings.colors) mergedColors = { ...CONFIG.TYPE_COLORS, ...activeStory.settings.colors };
                if (activeStory.settings.icons) mergedIcons = { ...activeStory.settings.icons };
                if (activeStory.settings.collapsedGroups && !this.searchState.active) {
                    collapsedGroups = activeStory.settings.collapsedGroups;
                }
                if (activeStory.settings.groupOrder) groupOrder = activeStory.settings.groupOrder;
                if (activeStory.settings.collapsedLevel1s) collapsedLevel1s = activeStory.settings.collapsedLevel1s;
            }
        }

        const layout = processTimelineData(dataToProcess, collapsedGroups, groupOrder, collapsedLevel1s, hiddenLevel1s);

        let highlightedEventIds = null;
        if (this.searchState.active && !this.searchState.criteria.hideNonMatching) {
            highlightedEventIds = new Set(this.searchState.matches.map(d => d.id));
        }

        this.renderer.render(layout, {
            preserveSlider,
            domain: customDomain,
            isDrilledDown: !!this.activeL0Category,
            typeColors: mergedColors,
            typeIcons: mergedIcons,
            collapsedGroups: collapsedGroups,
            highlightedEventIds: highlightedEventIds
        });
    }

    updateHeader(story) {
        const titleEl = document.getElementById('story-title');
        if (titleEl) {
            titleEl.textContent = story.name || "Company Timeline";
            titleEl.title = story.description || "";
        }
    }

    refreshHandler(options = {}) {
        if (options.resetView) this.activeL0Category = null;

        const activeStory = this.storage.getActiveStory();
        if (activeStory && window.timelineData) {
            this.storage.saveActiveStory(window.timelineData);
        }

        if (this.searchController) this.searchController.loadEventTypes();

        this.renderTimeline(options);
    }

    bindRendererEvents() {
        this.renderer.onCategoryDblClick = (category) => this.handleCategoryDblClick(category);
        this.renderer.onBackButtonClick = () => {
            this.activeL0Category = null;
            this.renderTimeline({ preserveSlider: true });
        };
        this.renderer.onEventDblClick = (e, d) => this.handleEventDblClick(e, d);
        this.renderer.onCategoryContextMenu = (e, category) => {
            const currentOrder = this.renderer.layoutData.map(l => l.level0);
            this.contextMenu.show(e, category, currentOrder);
        };
        this.renderer.onContainerContextMenu = (e) => {
            this.contextMenu.show(e, null, null, window.timelineData);
        };

        this.renderer.onSliderMove = (date, activeEvents) => this.handleSliderMove(date, activeEvents);
        this.renderer.onEventHover = (e, d) => this.handleEventHover(e, d);
    }

    handleCategoryDblClick(category) {
        console.log("Drilling down to:", category);
        const activeStory = this.storage.getActiveStory();
        if (activeStory && activeStory.settings && activeStory.settings.collapsedGroups) {
            const collapsedGroups = [...activeStory.settings.collapsedGroups];
            const idx = collapsedGroups.indexOf(category);
            if (idx > -1) {
                collapsedGroups.splice(idx, 1);
                this.storage.updateStorySettings(activeStory.id, {}, { collapsedGroups });
            }
        }
        this.activeL0Category = category;
        this.renderTimeline({ preserveSlider: true });
    }

    handleEventDblClick(e, d) {
        console.log("Extreme focus on event:", d.title);
        const activeStory = this.storage.getActiveStory();
        if (!activeStory) return;

        const isConsecutive = (this.lastFocusedEventId === d.id);
        this.lastFocusedEventId = d.id;

        if (isConsecutive) {
            const allData = window.timelineData || [];
            const { collapsedGroups, collapsedLevel1s } = calculateFocusCollapse(d, allData, activeStory);
            this.storage.updateStorySettings(activeStory.id, {}, {
                collapsedGroups,
                collapsedLevel1s
            });
        }

        this.renderTimeline({
            domain: [d.startDate, d.endDate],
            preserveSlider: true
        });

        if (isConsecutive) {
            setTimeout(() => {
                const selector = `[data-id="${d.id}"]`;
                const el = document.querySelector(`.event-bar${selector}`) || document.querySelector(`.event-triangle${selector}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    handleSliderMove(date, activeEvents) {
        const dateLabel = document.getElementById('current-slider-date');
        const eventsList = document.getElementById('active-events-list');

        if (dateLabel) dateLabel.textContent = formatMonthYearFriendly(date);

        if (eventsList) {
            if (activeEvents.length === 0) {
                eventsList.innerHTML = '<div class="empty-state">No events active at this time.</div>';
            } else {
                eventsList.innerHTML = activeEvents.map(e => {
                    const color = CONFIG.TYPE_COLORS[e.type.toLowerCase()] || CONFIG.COLORS.default;
                    return `
                    <div class="event-item" style="border-left-color: ${color}">
                        <span class="event-item-title">${e.title}</span>
                        <div class="event-item-meta">
                            <strong>${e.parentContext || e.level0}</strong> &middot; ${e.type}<br>
                            ${formatDateFriendly(e.startDate)} to ${e.isEvent ? 'Point Event' : formatDateFriendly(e.endDate)}
                        </div>
                    </div>`;
                }).join('');
            }
        }

        if (this.searchState.active && this.searchState.matches.length > 0) {
            // Search is active, do NOT override map pins based on slider
        } else {
            this.updateMapAndGallery(activeEvents);
        }
    }

    handleEventHover(e, d) {
        if (this.renderer.isMapPanelOpen) {
            const activeStory = this.storage.getActiveStory();
            const typeIcons = (activeStory?.settings?.icons) || {};
            const typeColors = (activeStory?.settings?.colors) || {};
            this.mapManager.addEventPin(d, true, {}, typeIcons, typeColors);
        }
        return false;
    }
}
