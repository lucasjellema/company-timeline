import { CONFIG, SAMPLE_CSV } from './config.js';
import { processTimelineData } from './layout-engine.js';
import { TimelineRenderer } from './renderer.js';

document.addEventListener('DOMContentLoaded', () => {
    const renderer = new TimelineRenderer('#timeline-viz');

    // UI Elements
    const dateLabel = document.getElementById('current-slider-date');
    const eventsList = document.getElementById('active-events-list');

    // Handle Slider Move
    renderer.onSliderMove = (date, activeEvents) => {
        dateLabel.textContent = d3.timeFormat("%B %Y")(date);

        if (activeEvents.length === 0) {
            eventsList.innerHTML = '<div class="empty-state">No events active at this time.</div>';
            return;
        }

        eventsList.innerHTML = activeEvents.map(e => {
            const color = CONFIG.TYPE_COLORS[e.type.toLowerCase()] || CONFIG.COLORS.default;
            return `
                <div class="event-item" style="border-left-color: ${color}">
                    <span class="event-item-title">${e.title}</span>
                    <div class="event-item-meta">
                        <strong>${e.level0}</strong> &middot; ${e.type}<br>
                        ${e.start} to ${e.end}
                    </div>
                </div>
            `;
        }).join('');
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
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>'
            }).addTo(this.map);

            // Handler for reset
            document.getElementById('reset-map-btn').addEventListener('click', () => {
                this.clearMarkers();
            });
        },
        addEventPin: function (d) {
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

            // Optional: Pan to it? Maybe not if we want to add multiple.
            // But usually it's nice to see what you added.
            this.map.panTo([lat, lng]);

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
                mapController.addEventPin(d);
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

    // Load default data
    loadCSV(SAMPLE_CSV);

    // Handle File Upload
    const uploadInput = document.getElementById('csv-upload');
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                loadCSV(event.target.result);
            };
            reader.readAsText(file);
        }
    });

    // Handle Sample Download
    document.getElementById('download-sample').addEventListener('click', () => {
        const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'company_timeline_sample.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    });

    function loadCSV(csvText) {
        try {
            const data = d3.csvParse(csvText);
            window.timelineData = data; // Store globally for add event feature
            const layout = processTimelineData(data);
            renderer.render(layout);
        } catch (error) {
            console.error("Error parsing CSV:", error);
            alert("Failed to parse CSV. Please check the format.");
        }
    }

    // --- Add Event Modal Logic ---
    function initAddEventModal() {
        const modal = document.getElementById('add-event-modal');
        const openBtn = document.getElementById('add-event-btn');
        const closeBtn = document.getElementById('close-modal-btn');
        const cancelBtn = document.getElementById('cancel-event-btn');
        const form = document.getElementById('add-event-form');

        let modalMap = null;
        let modalMarker = null;

        // Open Modal
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            populateDropdowns();
            initModalMap();
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
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Populate Datalists
        function populateDropdowns() {
            if (!window.timelineData) return;

            const getUnique = (key) => [...new Set(window.timelineData.map(d => d[key]).filter(Boolean))].sort();

            const l0 = getUnique('level0');
            const l1 = getUnique('level1');
            const l2 = getUnique('level2');

            const fillList = (id, items) => {
                const dl = document.getElementById(id);
                dl.innerHTML = items.map(i => `<option value="${i}">`).join('');
            };

            fillList('l0-options', l0);
            fillList('l1-options', l1);
            fillList('l2-options', l2);
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
                window.timelineData.push(formData);
                const layout = processTimelineData(window.timelineData);
                renderer.render(layout);
                closeModal();
            }
        });
    }

    initAddEventModal();

    // Handle Resize
    window.addEventListener('resize', () => {
        if (renderer.layoutData) {
            renderer.render(renderer.layoutData, true);
        }
    });
});
