import { CONFIG, SAMPLE_CSV } from './config.js';
import { parseDate } from './utils.js';
import { processTimelineData } from './layout-engine.js';
import { TimelineRenderer } from './renderer.js';
import { TimelineStorage } from './storage.js';
import { MapManager } from './map-manager.js';
import { initSplitter, initTabs, initZoomControls } from './ui-controls.js';
import { initEventEditor } from './event-editor.js';
import { initStoryUI } from './story-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const renderer = new TimelineRenderer('#timeline-viz');
    const storage = new TimelineStorage();
    const mapManager = new MapManager('side-panel-map');

    // State
    // window.timelineData is used globally by other modules (a legacy pattern we kept for refactor ease)
    let activeL0Category = null;

    // --- Core Render Logic ---
    function renderTimeline(options = {}) {
        const preserveSlider = options.preserveSlider || false;

        // 1. Filter Data
        let dataToProcess = window.timelineData || [];
        if (activeL0Category) {
            dataToProcess = dataToProcess.filter(d => d.level0 === activeL0Category);
            if (dataToProcess.length === 0) {
                activeL0Category = null;
                dataToProcess = window.timelineData;
            }
        }

        // 3. Get Configs (moved up to support layout filtering)
        const activeStory = storage.getActiveStory();
        let customDomain = null;
        let mergedColors = CONFIG.TYPE_COLORS;
        let mergedIcons = {};
        let collapsedGroups = [];
        let groupOrder = [];

        if (activeStory) {
            updateHeader(activeStory);

            if (activeStory.startDate && activeStory.endDate) {
                const s = parseDate(activeStory.startDate);
                const e = parseDate(activeStory.endDate);
                if (s && e) customDomain = [s, e];
            }
            if (activeStory.settings) {
                if (activeStory.settings.colors) mergedColors = { ...CONFIG.TYPE_COLORS, ...activeStory.settings.colors };
                if (activeStory.settings.icons) mergedIcons = { ...activeStory.settings.icons };
                if (activeStory.settings.collapsedGroups) collapsedGroups = activeStory.settings.collapsedGroups;
                if (activeStory.settings.groupOrder) groupOrder = activeStory.settings.groupOrder;
            }
        }

        // 2. Process Layout
        const layout = processTimelineData(dataToProcess, collapsedGroups, groupOrder);

        // 4. Render
        renderer.render(layout, {
            preserveSlider,
            domain: customDomain,
            isDrilledDown: !!activeL0Category,
            typeColors: mergedColors,
            typeIcons: mergedIcons,
            collapsedGroups: collapsedGroups
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
        updateMapPins(activeEvents);
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
        if (target === 'map') mapManager.initIfNeeded();
    });

    // Editors & Story UI
    initEventEditor(renderer, refreshHandler);
    initStoryUI(storage, refreshHandler);

    // --- Initial Load ---
    const startStory = storage.getActiveStory();
    if (startStory) {
        window.timelineData = startStory.data;
        renderTimeline();
    } else {
        const data = d3.csvParse(SAMPLE_CSV);
        storage.createStory("Sample Project Story", data);
        window.timelineData = data;
        renderTimeline();
    }

    // Resize Handler
    window.addEventListener('resize', () => {
        if (renderer.layoutData) renderTimeline({ preserveSlider: true });
    });
});
