import { CONFIG, SAMPLE_CSV } from './config.js';
import { parseDate } from './utils.js';
import { processTimelineData } from './layout-engine.js';
import { TimelineRenderer } from './renderer.js';
import { TimelineStorage } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
    const renderer = new TimelineRenderer('#timeline-viz');
    const storage = new TimelineStorage();

    // UI Elements
    const dateLabel = document.getElementById('current-slider-date');
    const eventsList = document.getElementById('active-events-list');

    // --- Initialization Logic (Moved to end) ---

    // State
    let activeL0Category = null;

    function renderTimeline(preserveSlider = false) {
        // Filter data if drilled down
        let dataToProcess = window.timelineData;
        if (activeL0Category) {
            dataToProcess = window.timelineData.filter(d => d.level0 === activeL0Category);
            // If filtering results in empty (e.g. category deleted), reset
            if (dataToProcess.length === 0) {
                activeL0Category = null;
                dataToProcess = window.timelineData;
            }
        }

        const layout = processTimelineData(dataToProcess);

        const activeStory = storage.getActiveStory();
        let customDomain = null;
        let mergedColors = CONFIG.TYPE_COLORS;
        let mergedIcons = {};

        // Update Header Info
        const titleEl = document.getElementById('story-title');
        if (titleEl && activeStory) {
            titleEl.textContent = activeStory.name || "Company Timeline";
            titleEl.title = activeStory.description || ""; // Description on hover

            // Check for custom bounds
            if (activeStory.startDate && activeStory.endDate) {
                const s = parseDate(activeStory.startDate);
                const e = parseDate(activeStory.endDate);
                if (s && e) {
                    customDomain = [s, e];
                }
            }

            // Check for custom colors
            if (activeStory.settings && activeStory.settings.colors) {
                mergedColors = { ...CONFIG.TYPE_COLORS, ...activeStory.settings.colors };
            }

            // Check for custom icons
            if (activeStory.settings && activeStory.settings.icons) {
                mergedIcons = { ...activeStory.settings.icons };
            }
        }

        renderer.render(layout, {
            preserveSlider,
            domain: customDomain,
            isDrilledDown: !!activeL0Category,
            typeColors: mergedColors,
            typeIcons: mergedIcons
        });
    }

    // Drill-down Interactivity
    renderer.onCategoryDblClick = (category) => {
        console.log("Drilling down to:", category);
        activeL0Category = category;
        renderTimeline(true); // Preserve slider position
    };

    renderer.onBackButtonClick = () => {
        console.log("Back from drill down");
        activeL0Category = null;
        renderTimeline(true);
    };

    // Override renderer update to save? No, save happens on explicit edits.

    // Import function for file upload
    function importCSV(csvText) {
        try {
            const data = d3.csvParse(csvText);

            // For now, importing creates a new story or overwrites?
            // User requirement isn't specific on import, but implies "edits" are saved.
            // Let's assume uploading a CSV creates a new story with a generic name.
            if (confirm("Create a new story from this CSV?")) {
                const name = `Imported Story ${new Date().toLocaleDateString()}`;
                storage.createStory(name, data);
                window.timelineData = data;
                activeL0Category = null;
                renderTimeline();
            }

        } catch (error) {
            console.error("Error parsing CSV:", error);
            alert("Failed to parse CSV. Please check the format.");
        }
    }

    // Handle Slider Move
    let lastActiveEventIds = "";

    renderer.onSliderMove = (date, activeEvents) => {
        dateLabel.textContent = d3.timeFormat("%B %Y")(date);

        // Deduplicate updates based on event sets to avoid heavy DOM/Map operations
        // IDs are numbers (indices), but we sort to be safe against order changes
        const currentIds = activeEvents.map(e => e.id).sort((a, b) => a - b).join(',');

        if (currentIds === lastActiveEventIds) return;
        lastActiveEventIds = currentIds;

        // Update Events List
        if (activeEvents.length === 0) {
            eventsList.innerHTML = '<div class="empty-state">No events active at this time.</div>';
        } else {
            eventsList.innerHTML = activeEvents.map(e => {
                const color = CONFIG.TYPE_COLORS[e.type.toLowerCase()] || CONFIG.COLORS.default;
                return `
                <div class="event-item" style="border-left-color: ${color}">
                    <span class="event-item-title">${e.title}</span>
                    <div class="event-item-meta">
                        <strong>${e.level0}</strong> &middot; ${e.type}<br>
                        ${d3.timeFormat("%b %d, %Y")(e.startDate)} to ${e.isEvent ? 'Point Event' : d3.timeFormat("%b %d, %Y")(e.endDate)}
                    </div>
                </div>
            `;
            }).join('');
        }

        // Update Map Pins
        // We sync the map regardless of whether the tab is active, 
        // to ensure it is ready when the user switches to it.
        mapController.clearMarkers();

        // Batch add markers
        // Batch add markers and collect bounds
        const boundsPoints = [];

        activeEvents.forEach(d => {
            const lat = parseFloat(d.lattitude || d.latitude);
            const lng = parseFloat(d.longitude || d.longtitude);

            if (!isNaN(lat) && !isNaN(lng)) {

                if (activeTabId === 'map') {
                    if (!mapController.map) mapController.initIfNeeded();
                    mapController.addEventPin(d, false); // Don't individual pan here
                    boundsPoints.push([lat, lng]);
                }
            }
        });

        // Fit bounds for all active events if map is visible
        if (activeTabId === 'map' && mapController.map && boundsPoints.length > 0) {
            // Use fitBounds but maybe throttle it or use flyTo if single point?
            // fitBounds can be jittery if points change rapidly.
            // If points are same as last frame, don't move.
            // But checking exact sameness is hard.
            // Let's just do it. Leaflet handles small moves okay usually.
            // Ensure maxZoom isn't too close
            mapController.map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 10, animate: true, duration: 0.5 });
        }
    };

    // Zoom Controls
    document.getElementById('zoom-in').addEventListener('click', () => renderer.zoom(0.5));
    document.getElementById('zoom-out').addEventListener('click', () => renderer.zoom(-0.5));

    // --- Tab Switching Logic ---
    const tabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    let activeTabId = 'events';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            activeTabId = target;

            // Update UI
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
            tabContents.forEach(c => c.classList.toggle('active', c.id === `tab-${target}`));

            renderer.isMapPanelOpen = (target === 'map');

            if (target === 'map') {
                mapController.initIfNeeded();
            }
        });
    });

    // --- Splitter Logic ---
    const splitter = document.getElementById('timeline-splitter');
    const sidePanel = document.getElementById('side-panel');
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    splitter.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = sidePanel.getBoundingClientRect().width;
        document.body.style.cursor = 'col-resize';
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        // Calculate delta. Moving left (negative delta) means increasing width.
        const delta = startX - e.clientX;
        const newWidth = startWidth + delta;

        // Constraints: Min 250px, Max 80% of screen width (leaving 20% for left side)
        const maxWidth = window.innerWidth * 0.8;

        if (newWidth > 250 && newWidth < maxWidth) {
            sidePanel.style.width = `${newWidth}px`;

            // Adjust map height to keep aspect ratio (optional, but requested) 
            // or just ensure it fills available vertical space? 
            // User asked: "height of map should increase accordingly". 
            // Simple approach: maintain a ratio or let it grow.
            // Let's set height proportional to width, e.g., 3:4 ratio or square.
            // Currently height is fixed in CSS or HTML? usually fixed pixels.
            // Let's make it responsive.
            const mapContainer = document.getElementById('side-panel-map');
            if (mapContainer) {
                mapContainer.style.height = `${newWidth * 0.75}px`;
            }

            // Force map resize check
            if (mapController.map) {
                mapController.map.invalidateSize();
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });


    // --- Map Manager ---
    const mapController = {
        map: null,
        markers: [],
        initIfNeeded: function () {
            if (this.map) {
                setTimeout(() => this.map.invalidateSize(), 100);
                return;
            }

            const mapContainer = document.getElementById('side-panel-map');
            if (!mapContainer) return;

            // Set initial height based on current width
            const width = mapContainer.clientWidth || 300;
            mapContainer.style.height = `${width * 0.75}px`;

            this.map = L.map('side-panel-map').setView([20, 0], 2);
            // Use Light tiles for better visibility
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(this.map);

            // Handler for reset
            document.getElementById('reset-map-btn').addEventListener('click', () => {
                this.clearMarkers();
            });
        },
        addEventPin: function (d, shouldPan = false) {
            if (!this.map) this.initIfNeeded();

            const lat = parseFloat(d.lattitude || d.latitude);
            const lng = parseFloat(d.longitude || d.longtitude);

            if (isNaN(lat) || isNaN(lng)) return;

            // Check if marker already exists for this exact location?
            // Or allow duplicates for different events?
            // User wants "pinpoint for that location" and "additional pinpoints are added".
            // So we accumulate them.

            const marker = L.marker([lat, lng]).addTo(this.map);
            marker.bindPopup(`
                <strong>${d.title}</strong><br>
                Type: ${d.type}<br>
                ${d.start} - ${d.end || 'Now'}<br>
                <div style="font-size:0.9em; margin-top:4px">${d.description}</div>
             `);

            marker.on('mouseover', function (e) {
                this.openPopup();
                renderer.highlightEvent(d.id);
            });

            marker.on('mouseout', function (e) {
                // this.closePopup(); // Optional: keep it open or close it? usually map popups stay until clicked off or another opens.
                // But for highlight we want it to stop when leaving.
                renderer.unhighlightEvent(d.id);
            });

            if (shouldPan) {
                this.map.flyTo([lat, lng], Math.max(this.map.getZoom(), 6), { duration: 1 });
            }

            this.markers.push(marker);
        },
        clearMarkers: function () {
            this.markers.forEach(m => this.map.removeLayer(m));
            this.markers = [];
        }
    };

    // --- Connect Renderer to Map ---
    renderer.onEventHover = (e, d) => {
        // If map tab is active, add pin to map
        if (activeTabId === 'map') {
            const lat = parseFloat(d.lattitude || d.latitude);
            const lng = parseFloat(d.longitude || d.longtitude);

            if (!isNaN(lat) && !isNaN(lng)) {
                mapController.addEventPin(d, true);
                return false; // Let renderer show tooltip too (as per requirement "tooltip is shown... details")
                // Actually user said: "When the user hovers over a pinpoint, a tooltip / popup is shown"
                // They didn't explicitly say NOT to show the timeline tooltip.
                // But typically if looking at map, we might want to focus there.
                // I will return FALSE so the simple tooltip continues to show on the timeline for feedback.
                // The map marker itself has a popup on hover.
            }
        }
        return false; // Default behavior
    };

    // Load default data handled by init logic above
    // loadCSV(SAMPLE_CSV);

    // Handle File Upload - Imports as new story
    const uploadInput = document.getElementById('csv-upload');
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                handleCSVImport(event.target.result);
            };
            reader.readAsText(file);
        }
    });

    // Handle Story Download
    document.getElementById('download-sample').addEventListener('click', () => {
        const activeStory = storage.getActiveStory();
        if (activeStory) {
            const jsonContent = JSON.stringify(activeStory, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Sanitize filename to be safe
            const safeName = (activeStory.name || 'story').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `${safeName}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            alert("No active story to download.");
        }
    });

    function handleCSVImport(csvText) {
        try {
            const data = d3.csvParse(csvText);
            if (confirm("Importing specific CSV. Create a new Story from this?")) {
                const name = `Imported Story ${new Date().toLocaleTimeString()}`;
                storage.createStory(name, data);
                window.timelineData = data;
                activeL0Category = null;
                renderTimeline();
            }
        } catch (error) {
            console.error("Error parsing CSV:", error);
            alert("Failed to parse CSV. Please check the format.");
        }
    }

    // Handle JSON Story Upload
    const uploadJsonInput = document.getElementById('json-upload');
    uploadJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const story = JSON.parse(event.target.result);
                    if (story && Array.isArray(story.data)) {
                        if (confirm(`Replace active story with "${story.name || 'Uploaded Story'}"?`)) {
                            storage.importStory(story);

                            // Update global state
                            window.timelineData = story.data;
                            activeL0Category = null;
                            renderTimeline();
                            console.log("Story imported and rendered:", story.name);
                        }
                    } else {
                        alert("Invalid Story JSON format. Missing 'data' array.");
                    }
                } catch (err) {
                    console.error("Error parsing JSON:", err);
                    alert("Failed to parse JSON file.");
                }
            };
            reader.readAsText(file);
        }
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    });



    // --- UI Logic: Modal & Context Menu ---
    function initUIInteractions() {
        const modal = document.getElementById('add-event-modal');
        const openBtn = document.getElementById('add-event-btn');
        const closeBtn = document.getElementById('close-modal-btn');
        const cancelBtn = document.getElementById('cancel-event-btn');
        const form = document.getElementById('add-event-form');
        const modalTitle = modal.querySelector('.modal-header h2');
        const submitBtn = form.querySelector('button[type="submit"]');

        let modalMap = null;
        let modalMarker = null;
        let isEditing = false;
        let editingIndex = -1;

        // Context Menu Elements
        const contextMenu = document.getElementById('context-menu');
        const ctxEdit = document.getElementById('ctx-edit');
        const ctxDelete = document.getElementById('ctx-delete');
        let currentContextEventId = null;

        // --- Context Menu Logic ---
        renderer.onEventContextMenu = (e, d) => {
            currentContextEventId = d.id; // Corresponds to index in timelineData

            // Position menu
            const x = e.pageX;
            const y = e.pageY;

            contextMenu.style.left = `${x}px`;
            contextMenu.style.top = `${y}px`;
            contextMenu.classList.remove('hidden');

            // Hide upon clicking elsewhere
            const hideMenu = () => {
                contextMenu.classList.add('hidden');
                document.removeEventListener('click', hideMenu);
            };
            document.addEventListener('click', hideMenu);
        };

        ctxDelete.addEventListener('click', () => {
            if (currentContextEventId !== null && window.timelineData) {
                if (confirm('Are you sure you want to delete this event?')) {
                    // Remove from data
                    window.timelineData.splice(currentContextEventId, 1);

                    refreshTimeline();
                }
            }
        });

        ctxEdit.addEventListener('click', () => {
            if (currentContextEventId !== null && window.timelineData) {
                const eventData = window.timelineData[currentContextEventId];
                if (eventData) {
                    openModal(true, eventData, currentContextEventId);
                }
            }
        });


        // --- Modal Logic ---

        function openModal(editMode = false, data = null, index = -1) {
            isEditing = editMode;
            editingIndex = index;

            modalTitle.textContent = editMode ? 'Edit Event' : 'Add New Event';
            submitBtn.textContent = editMode ? 'Update Event' : 'Add Event';

            modal.classList.remove('hidden');
            populateDropdowns();
            initModalMap();

            if (editMode && data) {
                // Populate Form
                document.getElementById('event-title').value = data.title || '';
                document.getElementById('event-type').value = data.type || 'project';
                document.getElementById('event-l0').value = data.level0 || '';
                document.getElementById('event-l1').value = data.level1 || '';
                document.getElementById('event-l2').value = data.level2 || '';
                document.getElementById('event-start').value = data.start || '';
                document.getElementById('event-end').value = data.end || '';
                document.getElementById('event-desc').value = data.description || '';

                const lat = parseFloat(data.lattitude || data.latitude);
                const lng = parseFloat(data.longitude || data.longtitude);

                // Set map inputs and marker
                if (!isNaN(lat) && !isNaN(lng)) {
                    document.getElementById('event-lat').value = lat;
                    document.getElementById('event-lng').value = lng;
                    document.getElementById('map-coords-display').textContent = `Selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

                    // Defer map update slightly to ensure container is visible
                    setTimeout(() => {
                        if (modalMap) {
                            if (modalMarker) modalMap.removeLayer(modalMarker);
                            modalMarker = L.marker([lat, lng]).addTo(modalMap);
                            modalMap.setView([lat, lng], 5);
                        }
                    }, 250);
                } else {
                    document.getElementById('event-lat').value = '';
                    document.getElementById('event-lng').value = '';
                    document.getElementById('map-coords-display').textContent = 'No location selected';
                    if (modalMarker && modalMap) {
                        modalMap.removeLayer(modalMarker);
                        modalMarker = null;
                    }
                }
            } else {
                // Add mode: default clear (form.reset called in close, but ensuring here)
            }
        }

        openBtn.addEventListener('click', () => {
            openModal(false);
        });

        // Close Modal
        const closeModal = () => {
            modal.classList.add('hidden');
            form.reset();
            if (modalMarker) {
                modalMap.removeLayer(modalMarker);
                modalMarker = null;
            }
            document.getElementById('map-coords-display').textContent = 'No location selected';
            isEditing = false;
            editingIndex = -1;
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Populate Datalists
        // Populate Datalists
        function populateDropdowns() {
            if (!window.timelineData) return;

            const getUnique = (key) => [...new Set(window.timelineData.map(d => d[key]).filter(Boolean))].sort();

            const l0 = getUnique('level0');
            const l1 = getUnique('level1');
            const l2 = getUnique('level2');

            // Default types + existing types in data
            const defaultTypes = ['project', 'release', 'milestone', 'sprint', 'training'];

            // Get existing types, normalize to lower case
            const currentTypes = window.timelineData.map(d => d.type ? d.type.toLowerCase() : null).filter(Boolean);

            // Normalize for case-insensitivity: merge and dedup
            const allTypes = [...new Set([...defaultTypes, ...currentTypes])].sort();

            const fillList = (id, items) => {
                const dl = document.getElementById(id);
                if (dl) dl.innerHTML = items.map(i => `<option value="${i}">`).join('');
            };

            fillList('l0-options', l0);
            fillList('l1-options', l1);
            fillList('l2-options', l2);
            fillList('type-options', allTypes);
        }

        // Initialize Map inside Modal
        function initModalMap() {
            if (modalMap) {
                setTimeout(() => modalMap.invalidateSize(), 200);
                return;
            }

            modalMap = L.map('modal-map').setView([20, 0], 2);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>'
            }).addTo(modalMap);

            modalMap.on('click', function (e) {
                const { lat, lng } = e.latlng;

                if (modalMarker) {
                    modalMap.removeLayer(modalMarker);
                }

                modalMarker = L.marker([lat, lng]).addTo(modalMap);

                document.getElementById('event-lat').value = lat.toFixed(6);
                document.getElementById('event-lng').value = lng.toFixed(6);
                document.getElementById('map-coords-display').textContent = `Selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            });

            // Fix display issue when modal opens
            setTimeout(() => modalMap.invalidateSize(), 200);
        }

        // Handle Form Submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = {
                title: document.getElementById('event-title').value,
                type: document.getElementById('event-type').value,
                level0: document.getElementById('event-l0').value,
                level1: document.getElementById('event-l1').value,
                level2: document.getElementById('event-l2').value,
                start: document.getElementById('event-start').value,
                end: document.getElementById('event-end').value, // Can be empty
                description: document.getElementById('event-desc').value,
                lattitude: document.getElementById('event-lat').value,
                longitude: document.getElementById('event-lng').value
            };

            if (window.timelineData) {
                if (isEditing && editingIndex > -1) {
                    // Update existing
                    window.timelineData[editingIndex] = { ...window.timelineData[editingIndex], ...formData };
                } else {
                    // Add new
                    window.timelineData.push(formData);
                }

                refreshTimeline();
                closeModal();
            }
        });

        function refreshTimeline() {
            try {
                const layout = processTimelineData(window.timelineData);
                renderer.render(layout, true); // Preserve slider position if possible

                // Persist changes
                const storage = new TimelineStorage();
                console.log("[Main] Saving story to storage...", window.timelineData.length);
                storage.saveActiveStory(window.timelineData);
            } catch (error) {
                console.error("[Main] Error in refreshTimeline/save:", error);
            }
        }
    }

    initUIInteractions();

    // --- Create Story UI Logic ---
    function initCreateStoryUI() {
        const modal = document.getElementById('create-story-modal');
        const openBtn = document.getElementById('create-story-btn');
        const closeBtn = document.getElementById('close-story-modal-btn');
        const cancelBtn = document.getElementById('cancel-story-btn');
        const form = document.getElementById('create-story-form');

        const openModal = () => {
            modal.classList.remove('hidden');
            // Default values? maybe current year
            const now = new Date();
            if (!document.getElementById('story-start').value) {
                document.getElementById('story-start').value = now.getFullYear();
                document.getElementById('story-end').value = now.getFullYear() + 1;
            }
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            form.reset();
        };

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const title = document.getElementById('story-title-input').value;
            const start = document.getElementById('story-start').value;
            const end = document.getElementById('story-end').value;
            const desc = document.getElementById('story-desc').value;

            // Create new story in storage
            // This replaces the current active story
            storage.createStory(title, [], { description: desc, start, end });

            // Clear current data + update view
            window.timelineData = [];
            activeL0Category = null;

            console.log(`[Main] Created new story: ${title}`);
            renderTimeline();

            closeModal();
        });
    }

    initCreateStoryUI();

    // --- Load Story UI Logic ---
    function initLoadStoryUI() {
        const modal = document.getElementById('load-story-modal');
        const openBtn = document.getElementById('load-story-btn');
        const closeBtn = document.getElementById('close-load-modal-btn');
        const listContainer = document.getElementById('story-list-container');

        const openModal = () => {
            modal.classList.remove('hidden');
            renderStoryList();
        };

        const closeModal = () => {
            modal.classList.add('hidden');
        };

        const renderStoryList = () => {
            const stories = storage.getStories();
            // Sort by last modified desc
            stories.sort((a, b) => b.lastModified - a.lastModified);

            if (stories.length === 0) {
                listContainer.innerHTML = '<div class="empty-state">No saved stories found. Create one!</div>';
                return;
            }

            // Get active story ID to highlight
            const activeStory = storage.getActiveStory();
            const activeId = activeStory ? activeStory.id : null;

            listContainer.innerHTML = stories.map(s => {
                const dateStr = new Date(s.lastModified).toLocaleString();
                const activeClass = (s.id === activeId) ? 'active-story-item' : '';
                return `
                    <li class="story-item ${activeClass}" data-id="${s.id}">
                        <div class="story-info">
                            <div class="story-title">${s.name}</div>
                            <div class="story-desc">${s.description || 'No description'}</div>
                            <div class="story-meta">Last modified: ${dateStr} &middot; ${s.eventCount} events</div>
                        </div>
                        <button class="btn btn-sm btn-primary load-btn" data-id="${s.id}">Load</button>
                    </li>
                `;
            }).join('');

            // Add Click Listeners
            listContainer.querySelectorAll('.load-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent li click if any
                    const id = e.target.dataset.id;
                    loadStory(id);
                });
            });

            // Also allow clicking the row
            listContainer.querySelectorAll('.story-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // if clicked button, ignore (handled above)
                    if (e.target.tagName === 'BUTTON') return;
                    const id = item.dataset.id;
                    loadStory(id);
                });
            });
        };

        const loadStory = (id) => {
            const story = storage.setActiveStory(id);
            if (story) {
                window.timelineData = story.data;
                activeL0Category = null;
                renderTimeline();
                console.log(`[Main] Loaded story: ${story.name}`);
                closeModal();
            }
        };

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    initLoadStoryUI();

    // --- Settings UI Logic ---
    function initSettingsUI() {
        const modal = document.getElementById('story-settings-modal');
        const openBtn = document.getElementById('settings-btn');
        const closeBtn = document.getElementById('close-settings-btn');
        const cancelBtn = document.getElementById('cancel-settings-btn');
        const form = document.getElementById('story-settings-form');
        const colorContainer = document.getElementById('color-settings-container');

        const openModal = () => {
            const activeStory = storage.getActiveStory();
            if (!activeStory) {
                alert("No active story to configure.");
                return;
            }

            modal.classList.remove('hidden');

            // Populate basic fields
            document.getElementById('settings-title').value = activeStory.name || '';
            document.getElementById('settings-desc').value = activeStory.description || '';

            // Populate Color Pickers
            renderSettings(activeStory);
        };

        const closeModal = () => {
            modal.classList.add('hidden');
        };

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        function renderSettings(story) {
            colorContainer.innerHTML = '';
            colorContainer.className = 'color-settings-list'; // Ensure correct class

            // Determine all unique types from current data + defaults
            const defaultTypes = Object.keys(CONFIG.TYPE_COLORS).filter(k => k !== 'default');
            const dataTypes = [...new Set(window.timelineData.map(d => d.type ? d.type.toLowerCase() : "").filter(Boolean))];
            const allTypes = [...new Set([...defaultTypes, ...dataTypes])].sort();

            // Get current saved colors or defaults
            const currentColors = (story.settings && story.settings.colors) ? story.settings.colors : {};
            const currentIcons = (story.settings && story.settings.icons) ? story.settings.icons : {};

            allTypes.forEach(type => {
                const defaultColor = CONFIG.TYPE_COLORS[type] || CONFIG.COLORS.default;
                const savedColor = currentColors[type] || defaultColor;
                const savedIcon = currentIcons[type] || '';

                const wrapper = document.createElement('div');
                wrapper.className = 'color-item';
                // wrapper.style.display = 'grid'; // Handled by CSS
                // wrapper.style.gridTemplateColumns = '1fr auto auto auto';

                const getIconSvg = (name) => {
                    const path = CONFIG.ICONS[name];
                    if (!path) return '';
                    return `<svg class="select-icon-svg" viewBox="0 0 24 24"><path d="${path}"></path></svg>`;
                };

                // Structure: Label | Custom Icon Select | Preview Bar | Edit Icon | Hidden Input
                wrapper.innerHTML = `
                    <span class="color-label">${type}</span>
                    
                    <div class="custom-select" id="custom-select-${type}">
                        <div class="select-selected">
                             ${savedIcon ? getIconSvg(savedIcon) : ''} <span>${savedIcon || 'No Icon'}</span>
                        </div>
                        <div class="select-items select-hide">
                             <div data-value="">No Icon</div>
                             ${Object.keys(CONFIG.ICONS).map(k => `
                                 <div data-value="${k}">
                                     ${getIconSvg(k)} <span>${k}</span>
                                 </div>
                             `).join('')}
                        </div>
                    </div>
                    <input type="hidden" name="icon-${type}" value="${savedIcon}" class="icon-input-hidden">

                    <div class="color-preview" style="background-color: ${savedColor};" id="preview-${type}"></div>
                    <label for="color-input-${type}" class="color-edit-icon" title="Change Color">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </label>
                    <input type="color" id="color-input-${type}" name="color-${type}" value="${savedColor}" class="color-input-hidden-picker" style="display:none;">
                `;

                // Add event listener to update preview immediately on change (for color)
                const input = wrapper.querySelector('input[type="color"]');
                const preview = wrapper.querySelector('.color-preview');
                input.addEventListener('input', (e) => {
                    preview.style.backgroundColor = e.target.value;
                });

                // Custom Select Logic
                const customSelect = wrapper.querySelector('.custom-select');
                const selectedDiv = customSelect.querySelector('.select-selected');
                const itemsDiv = customSelect.querySelector('.select-items');
                const hiddenInput = wrapper.querySelector('.icon-input-hidden');

                selectedDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeAllSelect(selectedDiv);
                    itemsDiv.classList.toggle('select-hide');
                    selectedDiv.classList.toggle('select-arrow-active');
                });

                const options = itemsDiv.querySelectorAll('div');
                options.forEach(option => {
                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const val = option.getAttribute('data-value');
                        const text = option.textContent.trim();
                        const svgHtml = val ? getIconSvg(val) : '';

                        selectedDiv.innerHTML = `${svgHtml} <span>${val || 'No Icon'}</span>`;
                        hiddenInput.value = val;

                        itemsDiv.classList.add('select-hide');
                        selectedDiv.classList.remove('select-arrow-active');
                    });
                });

                colorContainer.appendChild(wrapper);
            });

            // Close all selects if clicked outside
            document.addEventListener('click', closeAllSelect);
        }

        function closeAllSelect(elm) {
            const items = document.getElementsByClassName("select-items");
            const selected = document.getElementsByClassName("select-selected");
            for (let i = 0; i < selected.length; i++) {
                if (elm !== selected[i]) {
                    selected[i].classList.remove("select-arrow-active");
                }
            }
            for (let i = 0; i < items.length; i++) {
                if (elm !== selected[i]) { // logic check: actually items are children, but we want to close all EXCEPT the current one if passed
                    // But easier: close ALL if elm is null. If elm is passed, don't close its list? 
                    // The standard w3schools pattern:
                    // ArrNo.push(i)
                }
                // Simpler: Just hide all. attempt to re-open if it was the target is handled by toggle
                if (!elm || !elm.parentNode.contains(items[i])) {
                    items[i].classList.add("select-hide");
                }
            }
        }


        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const activeStory = storage.getActiveStory();
            if (!activeStory) return;

            const newName = document.getElementById('settings-title').value;
            const newDesc = document.getElementById('settings-desc').value;

            // Collect colors
            const newColors = {};
            const inputs = colorContainer.querySelectorAll('input[type="color"]');
            inputs.forEach(input => {
                const type = input.name.replace('color-', '');
                newColors[type] = input.value;
            });


            // Collect icons
            const newIcons = {};
            const iconInputs = colorContainer.querySelectorAll('input.icon-input-hidden');
            iconInputs.forEach(input => {
                const type = input.name.replace('icon-', '');
                if (input.value) {
                    newIcons[type] = input.value;
                }
            });

            // Save to storage
            // Note: window.timelineData is kept as is, only metadata changes
            storage.updateStorySettings(activeStory.id, {
                name: newName,
                description: newDesc
            }, {
                colors: newColors,
                icons: newIcons
            });

            // Force refresh of header and chart
            closeModal();
            renderTimeline(true); // Preserve slider
        });
    }

    initSettingsUI();

    // --- Initialization Logic ---
    const activeStory = storage.getActiveStory();
    if (activeStory) {
        // Load existing story
        window.timelineData = activeStory.data;
        renderTimeline();
        console.log(`Loaded story: ${activeStory.name}`);
    } else {
        // Initialize with Sample Data
        const data = d3.csvParse(SAMPLE_CSV);
        // Create Default Story
        storage.createStory("Sample Project Story", data);
        window.timelineData = data;
        renderTimeline();
    }

    // Handle Resize
    window.addEventListener('resize', () => {
        if (renderer.layoutData) {
            renderer.render(renderer.layoutData, true);
        }
    });
});
