import { CONFIG, SAMPLE_CSV } from './config.js';
import { parseDate, ensureDataIds } from './utils.js';
import { processTimelineData } from './layout-engine.js';
import { TimelineRenderer } from './renderer.js';
import { TimelineStorage } from './storage.js';
import { MapManager } from './map-manager.js';
import { GalleryManager } from './gallery-manager.js';
import { initSplitter, initTabs, initZoomControls } from './ui-controls.js';
import { initEventEditor } from './event-editor.js';
import { initStoryUI, loadShippedStory } from './story-ui.js';
import { SearchController } from './search-controller.js';
import { ThemeManager } from './theme-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Theme Init
    const themeManager = new ThemeManager();
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => themeManager.toggle());
    }

    const renderer = new TimelineRenderer('#timeline-viz');
    const storage = new TimelineStorage();
    renderer.storage = storage; // Attach storage for image retrieval during rendering
    const mapManager = new MapManager('side-panel-map', storage);
    const galleryManager = new GalleryManager('tab-gallery', storage, {
        onHover: (d, e) => {
            renderer.highlightEvent(d.id);
            renderer.handleEventHover(e, d, { hideImage: true });
        },
        onBlur: (id) => {
            renderer.unhighlightEvent(id);
            renderer.tooltip.hide();
        }
    });

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
            // Clear map/gallery on reset? Usually happens via slider update in renderTimeline if it moves, 
            // but if slider doesn't move, we should clear explicit search results.
            // Actually, renderTimeline sets data, which might not move slider.
            // But if we clear search, we go back to slider-based view.
            return;
        }

        // Calculate Collapsed/Hidden Groups based on Matches
        const collapsedGroups = new Set();
        const hiddenLevel1s = new Set();

        if (criteria) { // Only if there IS a search criteria
            // Find ALL L0s and L1s in original data (to know what exists)
            // (Actually we can just check matches vs implicit knowledge, 
            // but to collapse NON-matching, we assume anything NOT in matches is collapsed/hidden)

            // 1. Identify "Matched" L0s and L1s
            const matchedL0s = new Set();
            const matchedL1s = new Set();

            matches.forEach(m => {
                if (m.level0) matchedL0s.add(m.level0);
                if (m.level0 && m.level1) matchedL1s.add(`${m.level0}|${m.level1}`);
            });

            // 2. Identify "All" L0s and L1s to find difference
            // We use window.timelineData (which is "dataToProcess" usually)
            const allData = window.timelineData || [];
            allData.forEach(d => {
                const l0 = d.level0;
                const l1 = d.level1;

                // Collapse L0 if not matched
                if (l0 && !matchedL0s.has(l0)) {
                    collapsedGroups.add(l0);
                }

                // Hide L1 if not matched (and L0 is NOT collapsed? Actually L0 collapsed implies L1 hidden visually, 
                // but if L0 IS matched, we might still want to hide unrelated L1s inside it)
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
            // Using parseDate for safety
            const start = d3.min(matches, d => parseDate(d.start));
            const end = d3.max(matches, d => d.end ? parseDate(d.end) : (d.start ? parseDate(d.start) : null));

            if (start && end) {
                // "Maximally (and only) show period" 
                // We clamp to the Search Criteria if it exists, to strictly avoid showing years outside criteria.

                let zoomStart = start;
                let zoomEnd = end;

                if (criteria.minDate && criteria.minDate > start) {
                    zoomStart = criteria.minDate;
                }
                // For Max (Until), criteria.maxDate is "Until". Matches Start < Until. 
                // But matches End can be anything.
                // However, "timeline should not show period [outside selection]".
                // If I search "Until 2025", and event goes to 2026. 
                // It is debatable if I should cut it. But consistent with "From" logic, let's respect the criteria as a view bound?
                // Actually usually "Until" doesn't imply "Cut view at".
                // But "From 2020... matching... not show year before".
                // I'll stick to: Zoom to Matches, BUT clamp Start if Criteria.minDate > MatchStart.
                // I won't clamp End unless explicitly requested, as seeing the future of an event is usually desired. 
                // Wait, if I clamp start, I cut the event.
                // The user explicitly asked for "not show any year before then".

                // Add minimal padding (e.g. 1%) only if we are NOT clamping?
                // If we clamp, we should probably stick to the clamp line.
                // If we don't clamp, we add padding.

                const span = zoomEnd - zoomStart;
                const pad = span * 0.02; // 2% padding

                // Apply padding
                let finalStart = new Date(zoomStart.getTime() - pad);
                let finalEnd = new Date(zoomEnd.getTime() + pad);

                // Re-Apply Clamp if it violates criteria
                if (criteria.minDate && finalStart < criteria.minDate) {
                    finalStart = criteria.minDate;
                }
                // If we want to strictly respect Until? "Until date" logic was "Start < Until".
                // It doesn't restrict End. So we don't clamp End.

                zoomRange = [finalStart, finalEnd];
            }
        }

        searchState = {
            active: true,
            criteria,
            matches,
            zoomRange,
            searchCollapsedGroups: Array.from(collapsedGroups),
            searchHiddenLevel1s: Array.from(hiddenLevel1s)
        };

        renderTimeline({ preserveSlider: true, domain: zoomRange });
        // Force update map/gallery with search results
        updateMapPins(searchState.matches);
        galleryManager.update(searchState.matches);
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
        let hiddenLevel1s = [];

        // Apply Search State Collapses/Hides if active
        if (searchState.active && searchState.searchCollapsedGroups) {
            // WE OVERRIDE/MERGE the settings? 
            // "Collapse any... that does not..." implies we should enforce it.
            // Let's use the search set as the base, maybe merge with existing if valid?
            // Actually, search specific view is transient. Let's prioritize search results.
            collapsedGroups = [...searchState.searchCollapsedGroups];
            // Also we might want to preserve user's collapsed groups if they ARE matched? 
            // No, user said "collapse... that does not contain". It doesn't say "Expand that DOES contain".
            // But usually search implies "Show me the result". If I search "Red", and "Red" is in "Group A" but "Group A" is collapsed, I expect it to expand.
            // Implicit requirement: Expand matched groups.
            // My logic above: I only added NON-matched to collapsedGroups.
            // Effectively, matched groups are NOT added, so they are expanded (default).
            // BUT if the user had ALREADY collapsed "Group A" (which contains match), does it expand?
            // "collapsedGroups" list in logic is "List of groups to collapse".
            // If I set `collapsedGroups = searchState.searchCollapsedGroups`, I am effectively ignoring storage settings for this render.
            // This is correct for search context: "Show matches".
        }

        if (searchState.active && searchState.searchHiddenLevel1s) {
            hiddenLevel1s = [...searchState.searchHiddenLevel1s];
        }

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
                if (activeStory.settings.collapsedGroups && !searchState.active) {
                    // Only use storage settings if search is NOT overriding them
                    collapsedGroups = activeStory.settings.collapsedGroups;
                }
                if (activeStory.settings.groupOrder) groupOrder = activeStory.settings.groupOrder;
                if (activeStory.settings.collapsedLevel1s) collapsedLevel1s = activeStory.settings.collapsedLevel1s;
            }
        }

        // 2. Process Layout
        const layout = processTimelineData(dataToProcess, collapsedGroups, groupOrder, collapsedLevel1s, hiddenLevel1s);

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

    // Extreme Focus on Event Double Click
    let lastFocusedEventId = null;
    renderer.onEventDblClick = (e, d) => {
        console.log("Extreme focus on event:", d.title);
        const activeStory = storage.getActiveStory();
        if (!activeStory) return;

        // 1. Calculate Zoom Domain
        // Use the event's start and end date. 
        // Note: Layout engine ensures endDate exists (defaults to +1 day for points)
        let start = d.startDate;
        let end = d.endDate;

        // Check if this is the second consecutive double-click on the same event
        const isConsecutive = (lastFocusedEventId === d.id);
        lastFocusedEventId = d.id;

        if (isConsecutive) {
            console.log("Triggering Stage 2: Collapse Groups");
            // 2. Collapse Logic
            const allData = window.timelineData || [];

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

            // Retrieve existing L1 collapse settings to preserve state of other groups (optional but good practice)
            let existingCollapsedL1s = (activeStory.settings && activeStory.settings.collapsedLevel1s) ? activeStory.settings.collapsedLevel1s : [];

            // Remove any existing entries for THIS Level 0 (reset state for this group)
            const prefix = `${d.level0}|`;
            let newCollapsedL1s = existingCollapsedL1s.filter(key => !key.startsWith(prefix));

            // Add all L1s in this L0 that describe groups OTHER than the event's own L1
            currentL1s.forEach(l1 => {
                // If the event has no L1, then ALL L1s are "others".
                // If the event has an L1, then only different L1s are "others".
                if (!d.level1 || l1 !== d.level1) {
                    newCollapsedL1s.push(`${d.level0}|${l1}`);
                }
            });

            // 3. Update Storage
            storage.updateStorySettings(activeStory.id, {}, {
                collapsedGroups: collapsedGroups,
                collapsedLevel1s: newCollapsedL1s
            });
        } else {
            console.log("Triggering Stage 1: Zoom Only");
        }

        // 4. Render
        // 4. Render
        renderTimeline({
            domain: [start, end],
            preserveSlider: true
        });

        // 5. Scroll to Event (Only on Stage 2 / Collapse)
        if (isConsecutive) {
            // Wait for slight D3 render delay if needed, or DOM update
            setTimeout(() => {
                const selector = `[data-id="${d.id}"]`;
                // Look for bar or triangle
                // Note: The element might be .event-bar or .event-triangle (inside a group)
                // d3 selection by attribute
                const el = document.querySelector(`.event-bar${selector}`) || document.querySelector(`.event-triangle${selector}`);

                if (el) {
                    console.log("Scrolling to focus event:", d.title);
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    console.warn("Could not find event element to scroll to:", d.id);
                }
            }, 100); // 100ms delay to ensure layout is stable
        }
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

        // If search is active, Map/Gallery should show ALL search matches, not just active/slider ones.
        if (searchState.active && searchState.matches.length > 0) {
            // Do not update map pins based on slider
        } else {
            updateMapPins(activeEvents);
            galleryManager.update(activeEvents);
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
                const activeStory = storage.getActiveStory();
                const typeIcons = (activeStory && activeStory.settings && activeStory.settings.icons) ? activeStory.settings.icons : {};
                const typeColors = (activeStory && activeStory.settings && activeStory.settings.colors) ? activeStory.settings.colors : {};

                const pt = mapManager.addEventPin(d, false, {
                    onHover: (id) => renderer.highlightEvent(id),
                    onBlur: (id) => renderer.unhighlightEvent(id)
                }, typeIcons, typeColors);
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
            const activeStory = storage.getActiveStory();
            const typeIcons = (activeStory && activeStory.settings && activeStory.settings.icons) ? activeStory.settings.icons : {};
            const typeColors = (activeStory && activeStory.settings && activeStory.settings.colors) ? activeStory.settings.colors : {};

            mapManager.addEventPin(d, true, {}, typeIcons, typeColors); // Pan to it
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
        if (target === 'gallery') {
            galleryManager.render();
        }
    });

    // Editors & Story UI
    initEventEditor(renderer, refreshHandler, storage);
    initStoryUI(storage, refreshHandler);

    // --- Initial Load ---
    // --- Initial Load ---
    const urlParams = new URLSearchParams(window.location.search);
    const shippedStoryParam = urlParams.get('shipped_story');
    let loadedFromParam = false;

    if (shippedStoryParam) {
        const stories = CONFIG.SHIPPED_STORIES || [];
        const match = stories.find(s => s.name.toLowerCase().includes(shippedStoryParam.toLowerCase()));

        if (match) {
            console.log("Loading shipped story from param:", match.name);
            loadShippedStory(match, storage, (opts) => {
                searchController.loadEventTypes();
                renderTimeline(opts);
            });
            loadedFromParam = true;
        }
    }

    if (!loadedFromParam) {
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
    }

    // Resize Handler
    window.addEventListener('resize', () => {
        if (renderer.layoutData) renderTimeline({ preserveSlider: true });
    });
});
