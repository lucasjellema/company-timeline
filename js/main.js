import { CONFIG, SAMPLE_CSV } from './config.js';
import { parseDate, ensureDataIds } from './utils.js';
import { processTimelineData } from './layout-engine.js';
import { TimelineRenderer } from './renderer.js';
import { TimelineStorage } from './storage.js';
import { MapManager } from './map-manager.js';
import { initSplitter, initTabs, initZoomControls } from './ui-controls.js';
import { initEventEditor } from './event-editor.js';
import { initStoryUI } from './story-ui.js';
import { SearchController } from './search-controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const renderer = new TimelineRenderer('#timeline-viz');
    const storage = new TimelineStorage();
    const mapManager = new MapManager('side-panel-map');

    // State
    // window.timelineData is used globally by other modules (a legacy pattern we kept for refactor ease)
    let activeL0Category = null;
    let searchState = {
        active: false,
        criteria: null,
        matches: [],
        zoomRange: null
    };

    const searchController = new SearchController(storage, (criteria, matches) => {
        if (!criteria) {
            searchState = { active: false, criteria: null, matches: [], zoomRange: null };
            renderTimeline({ preserveSlider: true }); // Reset view
            return;
        }

        // Calculate zoom range from matches
        let zoomRange = null;
        if (matches.length > 0) {
            const start = d3.min(matches, d => d.startDate);
            const end = d3.max(matches, d => d.endDate || d.startDate); // Handle point events
            if (start && end) {
                // Add some buffer (10%)
                const span = end - start;
                // If span is 0 (single point), add 1 month buffer
                if (span === 0) {
                    zoomRange = [d3.timeMonth.offset(start, -1), d3.timeMonth.offset(start, 1)];
                } else {
                    zoomRange = [new Date(start.getTime() - span * 0.1), new Date(end.getTime() + span * 0.1)];
                }
            }
        }

        searchState = {
            active: true,
            criteria,
            matches,
            zoomRange
        };

        renderTimeline({ preserveSlider: true, domain: zoomRange });
        // Force update map with search results immediately (passing false to not rely on active tab check inside yet, or we assume render handled it?)
        // Actually, updateMapPins checks getActiveTab. If Search tab is open, we might want to update Map if user switches to Map tab.
        // But if user is on Search tab, Map is hidden.
        // If user switches to Map tab later, it should show search results.
        // The best way is to have updateMapPins use searchState if active.
        updateMapPins(searchState.matches);
    });

    searchController.init();

    // --- Core Render Logic ---
    function renderTimeline(options = {}) {
        const preserveSlider = options.preserveSlider || false;

        // 1. Filter Data
        let dataToProcess = window.timelineData || [];

        // L0 Drilldown Filter
        if (activeL0Category) {
            dataToProcess = dataToProcess.filter(d => d.level0 === activeL0Category);
            if (dataToProcess.length === 0) {
                activeL0Category = null;
                dataToProcess = window.timelineData;
            }
        }

        // Search "Hide" Filter
        if (searchState.active && searchState.criteria.hideNonMatching) {
            // matches contains the full objects, but we might want to filter by ID for safety or just use matches
            // However, matches were found against the FULL dataset.
            // If we are drilled down, we should intersect matches with current view?
            // The requirement says "left panel is updated accordingly".
            // If I drill down AND search, it should probably respect both (intersection).
            // But matches were returned from SearchController based on FULL data.

            const matchIds = new Set(searchState.matches.map(d => d.id));
            dataToProcess = dataToProcess.filter(d => matchIds.has(d.id));
        }

        // 3. Get Configs (moved up to support layout filtering)
        const activeStory = storage.getActiveStory();
        let customDomain = options.domain || null; // Allow passing domain in options (for zoom)

        let mergedColors = CONFIG.TYPE_COLORS;
        let mergedIcons = {};
        let collapsedGroups = [];
        let groupOrder = [];
        let collapsedLevel1s = [];

        if (activeStory) {
            updateHeader(activeStory);

            // Only use story domain if NO custom domain passed (e.g. from search zoom)
            if (!customDomain && activeStory.startDate && activeStory.endDate) {
                const s = parseDate(activeStory.startDate);
                const e = parseDate(activeStory.endDate);
                if (s && e) customDomain = [s, e];
            }
            if (activeStory.settings) {
                if (activeStory.settings.colors) mergedColors = { ...CONFIG.TYPE_COLORS, ...activeStory.settings.colors };
                if (activeStory.settings.icons) mergedIcons = { ...activeStory.settings.icons };
                if (activeStory.settings.collapsedGroups) collapsedGroups = activeStory.settings.collapsedGroups;
                if (activeStory.settings.groupOrder) groupOrder = activeStory.settings.groupOrder;
                if (activeStory.settings.collapsedLevel1s) collapsedLevel1s = activeStory.settings.collapsedLevel1s;
            }
        }

        // 2. Process Layout
        const layout = processTimelineData(dataToProcess, collapsedGroups, groupOrder, collapsedLevel1s);

        // Calculate highlighted IDs for rendering
        let highlightedEventIds = null;
        if (searchState.active && !searchState.criteria.hideNonMatching) {
            highlightedEventIds = new Set(searchState.matches.map(d => d.id));
        }

        // 4. Render
        renderer.render(layout, {
            preserveSlider,
            domain: customDomain,
            isDrilledDown: !!activeL0Category,
            typeColors: mergedColors,
            typeIcons: mergedIcons,
            collapsedGroups: collapsedGroups,
            highlightedEventIds: highlightedEventIds
        });
    }

    function updateHeader(story) {
        const titleEl = document.getElementById('story-title');
        if (titleEl) {
            titleEl.textContent = story.name || "Company Timeline";
            titleEl.title = story.description || "";
        }
    }

    function refreshHandler(options = {}) {
        if (options.resetView) activeL0Category = null;

        // Save logic: Every refresh implies a potential data change we should persist? 
        // Not necessarily, but event editor calls this after modifying window.timelineData.
        // Story UI calls this after switching stories (so data is new).
        // Let's ensure we save the CURRENT active story state if we are just editing.
        // Ideally handled by the editor, but let's be safe.
        // Actually `event-editor.js` logic was: modify array -> refresh. 
        // We should save to storage here if dirty??

        const activeStory = storage.getActiveStory();
        if (activeStory && window.timelineData) {
            storage.saveActiveStory(window.timelineData);
        }

        // Refresh search types as data might have changed
        if (searchController) searchController.loadEventTypes();

        renderTimeline(options);
    }

    // --- Interactivity Wiring ---



    // Drill-down
    renderer.onCategoryDblClick = (category) => {
        console.log("Drilling down to:", category);

        // Auto-expand if collapsed
        const activeStory = storage.getActiveStory();
        if (activeStory && activeStory.settings && activeStory.settings.collapsedGroups) {
            const collapsedGroups = [...activeStory.settings.collapsedGroups];
            const idx = collapsedGroups.indexOf(category);
            if (idx > -1) {
                collapsedGroups.splice(idx, 1);
                storage.updateStorySettings(activeStory.id, {}, { collapsedGroups });
                console.log(`Auto-expanding ${category} for drill-down`);
            }
        }

        activeL0Category = category;
        renderTimeline({ preserveSlider: true });
    };

    renderer.onBackButtonClick = () => {
        activeL0Category = null;
        renderTimeline({ preserveSlider: true });
    };

    // Collapse/Expand/Move Context Menu
    const ctxMenu = document.getElementById('context-menu');
    let ctxMenuContext = null; // Store context (category, etc)

    // Global click to hide menu
    document.addEventListener('click', (e) => {
        if (!ctxMenu.classList.contains('hidden')) {
            ctxMenu.classList.add('hidden');
        }
    });

    renderer.onCategoryContextMenu = (e, category) => {
        const activeStory = storage.getActiveStory();
        if (!activeStory) return;

        // Prevent browser menu
        // Event default prevention is handled in renderer-events.js, but good to be safe if passed
        // e is now passed

        ctxMenu.classList.remove('hidden');
        ctxMenu.style.left = `${e.pageX}px`;
        ctxMenu.style.top = `${e.pageY}px`;

        // Determine state
        let collapsedGroups = (activeStory.settings && activeStory.settings.collapsedGroups) ? [...activeStory.settings.collapsedGroups] : [];
        const isCollapsed = collapsedGroups.includes(category);

        const currentOrder = renderer.layoutData.map(l => l.level0);
        const idx = currentOrder.indexOf(category);
        const canMoveUp = idx > 0;
        const canMoveDown = idx < currentOrder.length - 1;

        // Show/Hide Items
        const btnUp = document.getElementById('ctx-move-up');
        const btnDown = document.getElementById('ctx-move-down');
        const btnExpand = document.getElementById('ctx-expand');
        const btnCollapse = document.getElementById('ctx-collapse');
        const btnEdit = document.getElementById('ctx-edit'); // Used for events? Hide for category
        const btnDelete = document.getElementById('ctx-delete'); // Used for events? Hide for category

        if (btnUp) btnUp.style.display = canMoveUp ? 'flex' : 'none';
        if (btnDown) btnDown.style.display = canMoveDown ? 'flex' : 'none';
        if (btnExpand) btnExpand.style.display = isCollapsed ? 'flex' : 'none';
        if (btnCollapse) btnCollapse.style.display = !isCollapsed ? 'flex' : 'none';

        // Hide event-specific items if they exist
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        // Hide L1-specific items
        const btnBExpandL1 = document.getElementById('ctx-expand-l1');
        const btnBCollapseL1 = document.getElementById('ctx-collapse-l1');
        if (btnBExpandL1) btnBExpandL1.style.display = 'none';
        if (btnBCollapseL1) btnBCollapseL1.style.display = 'none';

        ctxMenuContext = { category, idx, currentOrder, activeStory };
    };

    // Bind Menu Actions (One-time binding usually preferred, but here simple if guarded)
    // We can just bind globally and use ctxMenuContext

    const bindMenuAction = (id, callback) => {
        const el = document.getElementById(id);
        if (!el) return;
        // Clone to remove old listeners
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('click', (e) => {
            e.stopPropagation();
            ctxMenu.classList.add('hidden');
            if (ctxMenuContext) callback(ctxMenuContext);
        });
    };

    bindMenuAction('ctx-move-up', ({ currentOrder, idx, activeStory }) => {
        if (idx <= 0) return;
        const newOrder = [...currentOrder];
        [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
        storage.updateStorySettings(activeStory.id, {}, { groupOrder: newOrder });
        renderTimeline({ preserveSlider: true });
    });

    bindMenuAction('ctx-move-down', ({ currentOrder, idx, activeStory }) => {
        if (idx >= currentOrder.length - 1) return;
        const newOrder = [...currentOrder];
        [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
        storage.updateStorySettings(activeStory.id, {}, { groupOrder: newOrder });
        renderTimeline({ preserveSlider: true });
    });

    bindMenuAction('ctx-expand', ({ category, activeStory }) => {
        let collapsedGroups = (activeStory.settings && activeStory.settings.collapsedGroups) ? [...activeStory.settings.collapsedGroups] : [];
        const idx = collapsedGroups.indexOf(category);
        if (idx > -1) {
            collapsedGroups.splice(idx, 1);
            storage.updateStorySettings(activeStory.id, {}, { collapsedGroups });
            renderTimeline({ preserveSlider: true });
        }
    });

    bindMenuAction('ctx-collapse', ({ category, activeStory }) => {
        let collapsedGroups = (activeStory.settings && activeStory.settings.collapsedGroups) ? [...activeStory.settings.collapsedGroups] : [];
        if (!collapsedGroups.includes(category)) {
            collapsedGroups.push(category);
            storage.updateStorySettings(activeStory.id, {}, { collapsedGroups });
            renderTimeline({ preserveSlider: true });
        }
    });

    // Slider Move & Map Sync
    const dateLabel = document.getElementById('current-slider-date');
    const eventsList = document.getElementById('active-events-list');
    let lastActiveEventIds = "";

    renderer.onSliderMove = (date, activeEvents) => {
        if (dateLabel) dateLabel.textContent = d3.timeFormat("%B %Y")(date);

        const currentIds = activeEvents.map(e => e.id).sort((a, b) => a - b).join(',');
        if (currentIds === lastActiveEventIds) return;
        lastActiveEventIds = currentIds;

        updateEventsList(activeEvents, eventsList);

        // If search is active, Map should show ALL search matches, not just active/slider ones.
        if (searchState.active && searchState.matches.length > 0) {
            // Do not update map pins based on slider
        } else {
            updateMapPins(activeEvents);
        }
    };

    function updateEventsList(events, container) {
        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state">No events active at this time.</div>';
        } else {
            container.innerHTML = events.map(e => {
                const color = CONFIG.TYPE_COLORS[e.type.toLowerCase()] || CONFIG.COLORS.default;
                return `
                <div class="event-item" style="border-left-color: ${color}">
                    <span class="event-item-title">${e.title}</span>
                    <div class="event-item-meta">
                        <strong>${e.level0}</strong> &middot; ${e.type}<br>
                        ${d3.timeFormat("%b %d, %Y")(e.startDate)} to ${e.isEvent ? 'Point Event' : d3.timeFormat("%b %d, %Y")(e.endDate)}
                    </div>
                </div>`;
            }).join('');
        }
    }

    function updateMapPins(events) {
        mapManager.clearMarkers();
        const boundsPoints = [];
        const isMapOpen = getActiveTab() === 'map';

        events.forEach(d => {
            if (isMapOpen) {
                const pt = mapManager.addEventPin(d, false, {
                    onHover: (id) => renderer.highlightEvent(id),
                    onBlur: (id) => renderer.unhighlightEvent(id)
                });
                if (pt) boundsPoints.push(pt);
            }
        });

        if (isMapOpen) {
            mapManager.fitBounds(boundsPoints);
        }
    }

    // Map Hover -> Timeline Highlight
    renderer.onEventHover = (e, d) => {
        if (getActiveTab() === 'map') {
            mapManager.addEventPin(d, true); // Pan to it
            // return false; // To show tooltip? code said return false handles it.
        }
        return false;
    };

    // --- Init Modules ---

    // UI Controls
    let resizeRaf = null;
    initSplitter('timeline-splitter', 'side-panel', mapManager, () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
            if (renderer.layoutData) renderTimeline({ preserveSlider: true });
            resizeRaf = null;
        });
    });
    initZoomControls(renderer);
    const getActiveTab = initTabs('.nav-tab', '.tab-content', (target) => {
        renderer.isMapPanelOpen = (target === 'map');
        if (target === 'map') {
            mapManager.initIfNeeded();
            // If returning to map tab and search is active, ensure pins are correct
            if (searchState.active && searchState.matches.length > 0) {
                updateMapPins(searchState.matches);
            } else {
                // Otherwise current renderer logic usually handles it via slider move, 
                // but we might need to force refresh if slider hasn't moved.
                // We can trigger a fake slider move or just assume last state is valid?
                // The 'updateMapPins' is usually called by slider. 
                // If we switch tabs, we might be stale.
                // renderer.getActiveEvents() ? We can't easily access that from here without triggering.
                // Let's rely on slider interaction OR force a render?
            }
        }
    });

    // Editors & Story UI
    initEventEditor(renderer, refreshHandler, storage);
    initStoryUI(storage, refreshHandler);

    // --- Initial Load ---
    const startStory = storage.getActiveStory();
    if (startStory) {
        window.timelineData = startStory.data;
        if (ensureDataIds(window.timelineData)) {
            storage.saveActiveStory(window.timelineData); // Persist IDs
        }
        searchController.loadEventTypes();
        renderTimeline();
    } else {
        const data = d3.csvParse(SAMPLE_CSV);
        ensureDataIds(data);
        storage.createStory("Sample Project Story", data);
        window.timelineData = data;
        searchController.loadEventTypes();
        renderTimeline();
    }

    // Resize Handler
    window.addEventListener('resize', () => {
        if (renderer.layoutData) renderTimeline({ preserveSlider: true });
    });
});
