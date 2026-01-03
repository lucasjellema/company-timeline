import { processTimelineData } from './layout-engine.js';
import { TimelineStorage } from './storage.js';
import { CONFIG } from './config.js';

export function initEventEditor(renderer, refreshCallback, storage) {
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
    // const ctxEdit = document.getElementById('ctx-edit'); // These will be dynamically re-bound
    // const ctxDelete = document.getElementById('ctx-delete'); // These will be dynamically re-bound

    // New Refs for L1 collapse/expand
    // const ctxExpandL1 = document.getElementById('ctx-expand-l1'); // These will be dynamically re-bound
    // const ctxCollapseL1 = document.getElementById('ctx-collapse-l1'); // These will be dynamically re-bound

    let currentContextEventId = null;
    let currentContextEvent = null; // Store full event object

    // Helper for binding menu actions (similar to main.js pattern could be used, but here valid)
    const bindMenuAction = (el, callback) => {
        if (!el) return;
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('click', (e) => {
            e.stopPropagation();
            contextMenu.classList.add('hidden');
            if (callback) callback();
        });
        return newEl; // Return reference if needed
    };

    // --- Context Menu Logic ---
    renderer.onEventContextMenu = (e, d) => {
        currentContextEventId = d.id;
        currentContextEvent = d;

        const x = e.pageX;
        const y = e.pageY;

        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.classList.remove('hidden');

        // Hide Category specific options logic (already present via ID lookup in main.js but here we manage Event context)
        // Ensure "Group" Move options are hidden
        const btnUp = document.getElementById('ctx-move-up');
        const btnDown = document.getElementById('ctx-move-down');
        const btnExpand = document.getElementById('ctx-expand');
        const btnCollapse = document.getElementById('ctx-collapse');

        if (btnUp) btnUp.style.display = 'none';
        if (btnDown) btnDown.style.display = 'none';
        if (btnExpand) btnExpand.style.display = 'none';
        if (btnCollapse) btnCollapse.style.display = 'none';

        // Event specific actions
        bindMenuAction(document.getElementById('ctx-edit'), () => {
            if (currentContextEventId !== null && window.timelineData) {
                const eventData = window.timelineData[currentContextEventId];
                if (eventData) {
                    openModal(true, eventData, currentContextEventId);
                }
            }
        }).style.display = 'flex';

        bindMenuAction(document.getElementById('ctx-delete'), () => {
            if (currentContextEventId !== null && window.timelineData) {
                if (confirm('Are you sure you want to delete this event?')) {
                    window.timelineData.splice(currentContextEventId, 1);
                    refreshCallback();
                }
            }
        }).style.display = 'flex';

        // L1 Group specific actions
        const hasL1 = !!d.level1;
        const ctxExpandL1 = document.getElementById('ctx-expand-l1');
        const ctxCollapseL1 = document.getElementById('ctx-collapse-l1');

        if (hasL1) {
            const activeStory = storage ? storage.getActiveStory() : null;
            const collapsedLevel1s = (activeStory && activeStory.settings && activeStory.settings.collapsedLevel1s) || [];
            const key = `${d.level0}|${d.level1}`;
            const isL1Collapsed = collapsedLevel1s.includes(key);

            if (ctxExpandL1) {
                bindMenuAction(ctxExpandL1, () => {
                    const currentActiveStory = storage.getActiveStory();
                    if (!currentActiveStory) return;
                    let currentCollapsedLevel1s = (currentActiveStory.settings && currentActiveStory.settings.collapsedLevel1s) ? [...currentActiveStory.settings.collapsedLevel1s] : [];
                    const currentKey = `${currentContextEvent.level0}|${currentContextEvent.level1}`;
                    const idx = currentCollapsedLevel1s.indexOf(currentKey);
                    if (idx > -1) {
                        currentCollapsedLevel1s.splice(idx, 1);
                        storage.updateStorySettings(currentActiveStory.id, {}, { collapsedLevel1s: currentCollapsedLevel1s });
                        refreshCallback();
                    }
                }).style.display = isL1Collapsed ? 'flex' : 'none';
                // Update text dynamically? "Expand [L1]"
                // ctxExpandL1.childNodes[2].textContent = ` Expand ${d.level1}`; 
            }
            if (ctxCollapseL1) {
                bindMenuAction(ctxCollapseL1, () => {
                    const currentActiveStory = storage.getActiveStory();
                    if (!currentActiveStory) return;
                    let currentCollapsedLevel1s = (currentActiveStory.settings && currentActiveStory.settings.collapsedLevel1s) ? [...currentActiveStory.settings.collapsedLevel1s] : [];
                    const currentKey = `${currentContextEvent.level0}|${currentContextEvent.level1}`;
                    if (!currentCollapsedLevel1s.includes(currentKey)) {
                        currentCollapsedLevel1s.push(currentKey);
                        storage.updateStorySettings(currentActiveStory.id, {}, { collapsedLevel1s: currentCollapsedLevel1s });
                        refreshCallback();
                    }
                }).style.display = !isL1Collapsed ? 'flex' : 'none';
                // ctxCollapseL1.childNodes[2].textContent = ` Collapse ${d.level1}`;
            }
        } else {
            if (ctxExpandL1) ctxExpandL1.style.display = 'none';
            if (ctxCollapseL1) ctxCollapseL1.style.display = 'none';
        }

        const hideMenu = () => {
            contextMenu.classList.add('hidden');
            document.removeEventListener('click', hideMenu);
        };
        document.addEventListener('click', hideMenu);
    };

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

            if (!isNaN(lat) && !isNaN(lng)) {
                document.getElementById('event-lat').value = lat;
                document.getElementById('event-lng').value = lng;
                document.getElementById('map-coords-display').textContent = `Selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

                setTimeout(() => {
                    if (modalMap) {
                        if (modalMarker) modalMap.removeLayer(modalMarker);
                        modalMarker = L.marker([lat, lng]).addTo(modalMap);
                        modalMap.setView([lat, lng], 5);
                    }
                }, 250);
            } else {
                clearMapSelection();
            }
        } else {
            // Add mode: default clear is handled by reset, but ensure map is clear
            clearMapSelection();
        }
    }

    function clearMapSelection() {
        document.getElementById('event-lat').value = '';
        document.getElementById('event-lng').value = '';
        document.getElementById('map-coords-display').textContent = 'No location selected';
        if (modalMarker && modalMap) {
            modalMap.removeLayer(modalMarker);
            modalMarker = null;
        }
    }

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            openModal(false);
        });
    }

    const closeModal = () => {
        modal.classList.add('hidden');
        form.reset();
        clearMapSelection();
        isEditing = false;
        editingIndex = -1;
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
        const defaultTypes = ['project', 'release', 'milestone', 'sprint', 'training'];
        const currentTypes = window.timelineData.map(d => d.type ? d.type.toLowerCase() : null).filter(Boolean);
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

    function initModalMap() {
        if (modalMap) {
            setTimeout(() => modalMap.invalidateSize(), 200);
            return;
        }

        if (typeof L === 'undefined') return;

        modalMap = L.map('modal-map').setView([20, 0], 2);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>'
        }).addTo(modalMap);

        modalMap.on('click', function (e) {
            const { lat, lng } = e.latlng;
            if (modalMarker) modalMap.removeLayer(modalMarker);
            modalMarker = L.marker([lat, lng]).addTo(modalMap);
            document.getElementById('event-lat').value = lat.toFixed(6);
            document.getElementById('event-lng').value = lng.toFixed(6);
            document.getElementById('map-coords-display').textContent = `Selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = {
            title: document.getElementById('event-title').value,
            type: document.getElementById('event-type').value,
            level0: document.getElementById('event-l0').value,
            level1: document.getElementById('event-l1').value,
            level2: document.getElementById('event-l2').value,
            start: document.getElementById('event-start').value,
            end: document.getElementById('event-end').value,
            description: document.getElementById('event-desc').value,
            lattitude: document.getElementById('event-lat').value,
            longitude: document.getElementById('event-lng').value
        };

        if (window.timelineData) {
            if (isEditing && editingIndex > -1) {
                window.timelineData[editingIndex] = { ...window.timelineData[editingIndex], ...formData };
            } else {
                window.timelineData.push(formData);
            }
            refreshCallback(); // Triggers render and save
            closeModal();
        }
    });

    // Import CSV Logic - moved from main or keep separate? 
    // The main 'Upload CSV' button in header is global, not inside modal.
    // So we'll handle that in Story UI or Main.
}
