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
                const index = window.timelineData.findIndex(e => e.id === currentContextEventId);
                if (index > -1) {
                    const eventData = window.timelineData[index];
                    openModal(true, eventData, index);
                }
            }
        }).style.display = 'flex';

        bindMenuAction(document.getElementById('ctx-delete'), () => {
            if (currentContextEventId !== null && window.timelineData) {
                const index = window.timelineData.findIndex(e => e.id === currentContextEventId);
                if (index > -1) {
                    if (confirm('Are you sure you want to delete this event?')) {
                        window.timelineData.splice(index, 1);
                        refreshCallback();
                    }
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

            // Robust key generation
            const l0 = (d.level0 || "").trim();
            const l1 = (d.level1 || "").trim();
            const key = `${l0}|${l1}`;

            const isL1Collapsed = collapsedLevel1s.includes(key);

            if (ctxExpandL1) {
                bindMenuAction(ctxExpandL1, () => {
                    const currentActiveStory = storage.getActiveStory();
                    if (!currentActiveStory) return;
                    let currentCollapsedLevel1s = (currentActiveStory.settings && currentActiveStory.settings.collapsedLevel1s) ? [...currentActiveStory.settings.collapsedLevel1s] : [];
                    // Key for closure context
                    const cL0 = (currentContextEvent.level0 || "").trim();
                    const cL1 = (currentContextEvent.level1 || "").trim();
                    const currentKey = `${cL0}|${cL1}`;

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

                    const cL0 = (currentContextEvent.level0 || "").trim();
                    const cL1 = (currentContextEvent.level1 || "").trim();
                    const currentKey = `${cL0}|${cL1}`;

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

            // Image
            const imgLocalId = data.imageLocalId;
            const imgUrl = data.imageUrl || '';
            document.getElementById('event-image').value = imgUrl;
            document.getElementById('event-image-local-id').value = imgLocalId || '';
            document.getElementById('file-name-display').textContent = '';

            const previewContainer = document.getElementById('event-image-preview-container');
            const previewImg = document.getElementById('event-image-preview');

            if (imgLocalId) {
                // Try from local storage
                const localData = storage.getImage(imgLocalId);
                if (localData) {
                    previewImg.src = localData;
                    previewContainer.classList.remove('hidden');
                } else {
                    // Fallback check if URL is present
                    if (imgUrl) {
                        previewImg.src = imgUrl;
                        previewContainer.classList.remove('hidden');
                    } else {
                        previewContainer.classList.add('hidden');
                        previewImg.src = '';
                    }
                }
            } else if (imgUrl) {
                previewImg.src = imgUrl;
                previewContainer.classList.remove('hidden');
            } else {
                previewContainer.classList.add('hidden');
                previewImg.src = '';
            }

            // Icon & Color
            const iconVal = data.icon || '';
            document.getElementById('event-icon').value = iconVal;
            if (window.updateIconSelection) window.updateIconSelection(iconVal);

            const colorInput = document.getElementById('event-color');
            if (data.color) {
                colorInput.value = data.color;
                colorInput.dataset.isEmpty = "false";
                colorInput.style.opacity = "1";
            } else {
                colorInput.value = "#000000";
                colorInput.dataset.isEmpty = "true";
                colorInput.style.opacity = "0.5";
            }

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

            // Clear Image
            document.getElementById('event-image').value = '';
            document.getElementById('event-image-local-id').value = '';
            document.getElementById('event-image-file').value = '';
            document.getElementById('file-name-display').textContent = '';

            const previewContainer = document.getElementById('event-image-preview-container');
            const previewImg = document.getElementById('event-image-preview');
            if (previewContainer) previewContainer.classList.add('hidden');
            if (previewImg) previewImg.src = '';

            // Explicitly reset icon/color
            document.getElementById('event-icon').value = '';
            if (window.updateIconSelection) window.updateIconSelection('');

            const colorInput = document.getElementById('event-color');
            if (colorInput) {
                colorInput.value = "#000000";
                colorInput.dataset.isEmpty = "true";
                colorInput.style.opacity = "0.5";
            }
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

    // Clear Color Logic
    const colorInput = document.getElementById('event-color');
    const clearColorBtn = document.getElementById('clear-color-btn');
    if (clearColorBtn && colorInput) {
        clearColorBtn.addEventListener('click', () => {
            colorInput.value = '#000000'; // Default input value, but we treat it as empty logic
            // We use a dataset attribute or just a transparent visual cue? 
            // Input type color always has a value. We probably need a way to say "no valid color".
            // We'll treat the hex value in the hidden model. But for the UI, let's just reset to default black 
            // and maybe we need a separate way to track "null".
            // Actually, let's use a specific "empty" state if possible. 
            // Browsers don't support empty color input well. 
            // Let's set a data-empty attribute.
            colorInput.dataset.isEmpty = "true";
            colorInput.value = "#000000"; // visual reset
            colorInput.style.opacity = "0.5";
        });
        colorInput.addEventListener('input', () => {
            colorInput.dataset.isEmpty = "false";
            colorInput.style.opacity = "1";
        });
    }

    // Image Logic (URL, File, Paste)
    const imageInput = document.getElementById('event-image');
    const imageFileInput = document.getElementById('event-image-file');
    const imageLocalIdInput = document.getElementById('event-image-local-id');
    const pasteArea = document.getElementById('paste-image-area');
    const fileNameDisplay = document.getElementById('file-name-display');
    const imagePreviewContainer = document.getElementById('event-image-preview-container');
    const imagePreview = document.getElementById('event-image-preview');
    const clearImageBtn = document.getElementById('clear-image-btn');

    function updateImagePreview(src, localId = null) {
        if (src) {
            imagePreview.src = src;
            imagePreviewContainer.classList.remove('hidden');
            if (localId) {
                imageLocalIdInput.value = localId;
                imageInput.value = ''; // prioritize local
            } else {
                imageLocalIdInput.value = '';
            }
        } else {
            imagePreviewContainer.classList.add('hidden');
            imagePreview.src = '';
            imageLocalIdInput.value = '';
            imageFileInput.value = '';
            fileNameDisplay.textContent = '';
        }
    }

    if (imageInput) {
        imageInput.addEventListener('input', () => {
            const url = imageInput.value.trim();
            if (url) {
                updateImagePreview(url);
            } else {
                // Only clear if no local image is set? 
                // If user clears URL but had local image, do we keep local?
                // Current logic: URL input overrides local if typed? 
                // Let's say if URL has content, we show it. 
                if (!imageLocalIdInput.value) {
                    updateImagePreview(null);
                }
            }
        });
    }

    if (imageFileInput) {
        imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                const reader = new FileReader();
                reader.onload = function (evt) {
                    const dataUrl = evt.target.result;
                    try {
                        const id = storage.saveImage(dataUrl);
                        updateImagePreview(dataUrl, id);
                    } catch (err) {
                        alert('Error saving image locally (Storage might be full)');
                        console.error(err);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (pasteArea) {
        pasteArea.addEventListener('paste', (e) => {
            e.preventDefault();
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            let blob = null;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') === 0) {
                    blob = items[i].getAsFile();
                    break;
                }
            }

            if (blob) {
                fileNameDisplay.textContent = "Pasted Image";
                const reader = new FileReader();
                reader.onload = function (evt) {
                    const dataUrl = evt.target.result;
                    try {
                        const id = storage.saveImage(dataUrl);
                        updateImagePreview(dataUrl, id);
                    } catch (err) {
                        alert('Error saving image locally (Storage might be full)');
                        console.error(err);
                    }
                };
                reader.readAsDataURL(blob);
            }
        });

        // Let user click to focus
        pasteArea.addEventListener('click', () => pasteArea.focus());
    }

    if (clearImageBtn) {
        clearImageBtn.addEventListener('click', () => {
            updateImagePreview(null);
            imageInput.value = '';
        });
    }

    if (imagePreview) {
        imagePreview.addEventListener('error', () => {
            // Only hide if we don't have a valid source? 
            // If local image fails to load?
            // imagePreviewContainer.classList.add('hidden');
        });
        imagePreview.addEventListener('load', () => {
            imagePreviewContainer.classList.remove('hidden');
        });
    }

    // Populate Datalists & Icons
    function populateDropdowns() {
        if (!window.timelineData) return;

        const getUnique = (key) => [...new Set(window.timelineData.map(d => d[key]).filter(Boolean))].sort();
        const l0 = getUnique('level0');
        const l1 = getUnique('level1');
        const l2 = getUnique('level2');
        const defaultTypes = ['event'];
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

        // Populate Icon Select
        initIconSelect();
    }

    function initIconSelect() {
        const wrapper = document.getElementById('event-icon-wrapper');
        if (!wrapper) return;

        const selectedDiv = wrapper.querySelector('.select-selected');
        const itemsDiv = wrapper.querySelector('.select-items');
        const hiddenInput = document.getElementById('event-icon');

        // Clear existing items (except first maybe?)
        itemsDiv.innerHTML = `
             <div class="icon-search-box" style="position: sticky; top: 0; background-color: var(--bg-card); z-index: 10; cursor: default; padding: 6px 8px;">
                <input type="text" placeholder="Search icons..." style="width: 100%; padding: 4px; box-sizing: border-box; background: var(--bg-input); border: 1px solid var(--border); color: var(--text-main); border-radius: 4px; font-size: 0.8rem;">
            </div>
            <div class="select-option" data-value="">No Icon</div>
        `;

        const getIconSvg = (name) => {
            const path = CONFIG.ICONS[name];
            return path ? `<svg class="select-icon-svg" viewBox="0 0 24 24"><path d="${path}"></path></svg>` : '';
        };

        const iconKeys = Object.keys(CONFIG.ICONS).sort();
        iconKeys.forEach(k => {
            const div = document.createElement('div');
            div.className = 'select-option';
            div.dataset.value = k;
            div.innerHTML = `${getIconSvg(k)} <span>${k}</span>`;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                updateIconSelection(k);
                itemsDiv.classList.add('select-hide');
                selectedDiv.classList.remove('select-arrow-active');
            });
            itemsDiv.appendChild(div);
        });

        // Search logic
        const searchInput = itemsDiv.querySelector('input');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            itemsDiv.querySelectorAll('.select-option').forEach(option => {
                const text = option.textContent.toLowerCase().trim();
                if (text.includes(term)) {
                    option.style.display = "";
                } else {
                    option.style.display = "none";
                }
            });
        });
        itemsDiv.querySelector('.icon-search-box').addEventListener('click', e => e.stopPropagation());

        // Toggle
        // Remove old listeners to avoid dupes if called multiple times? 
        // Better to use a flag or clone.
        const newSelected = selectedDiv.cloneNode(true);
        selectedDiv.parentNode.replaceChild(newSelected, selectedDiv);

        newSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllSelect(newSelected); // Ensure others close
            itemsDiv.classList.toggle('select-hide');
            newSelected.classList.toggle('select-arrow-active');
            if (!itemsDiv.classList.contains('select-hide')) {
                setTimeout(() => searchInput.focus(), 100);
            }
        });

        // Bind global close
        document.addEventListener('click', closeAllSelect);

        // Helper to update visual
        window.updateIconSelection = (val) => {
            hiddenInput.value = val || "";
            const svg = val ? getIconSvg(val) : "";
            newSelected.innerHTML = `${svg} <span>${val || 'No Icon'}</span>`;
        };

        // Initial "No Icon" click
        itemsDiv.querySelector('.select-option[data-value=""]').addEventListener('click', (e) => {
            e.stopPropagation();
            updateIconSelection("");
            itemsDiv.classList.add('select-hide');
            newSelected.classList.remove('select-arrow-active');
        });
    }

    function closeAllSelect(elm) {
        const items = document.getElementsByClassName("select-items");
        const selected = document.getElementsByClassName("select-selected");
        // Only close if not clicking on the element itself?
        // Logic copied from story-settings can be reused or simplified
        // Here we just close the specific one if we want, but global close is standard.
        // We need to be careful not to break story-settings one if they coexist?
        // Modals are overlay, so usually fine.
        for (let i = 0; i < selected.length; i++) {
            if (elm !== selected[i]) selected[i].classList.remove("select-arrow-active");
        }
        for (let i = 0; i < items.length; i++) {
            if (!elm || !elm.parentNode.parentNode.contains(items[i])) {
                items[i].classList.add("select-hide");
            }
        }
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

        const colorIn = document.getElementById('event-color');
        const colorVal = (colorIn.dataset.isEmpty === "true") ? null : colorIn.value;

        const formData = {
            title: document.getElementById('event-title').value,
            type: document.getElementById('event-type').value,
            level0: document.getElementById('event-l0').value,
            level1: document.getElementById('event-l1').value,
            level2: document.getElementById('event-l2').value,
            start: document.getElementById('event-start').value,
            end: document.getElementById('event-end').value,
            description: document.getElementById('event-desc').value,
            imageUrl: document.getElementById('event-image').value || null,
            imageLocalId: document.getElementById('event-image-local-id').value || null,
            lattitude: document.getElementById('event-lat').value,
            longitude: document.getElementById('event-lng').value,
            icon: document.getElementById('event-icon').value || null,
            color: colorVal
        };

        // Remove null/empty keys if robust? 
        // Actually rendering logic checks d.icon || fallback. So null is fine.

        if (window.timelineData) {
            if (isEditing && editingIndex > -1) {
                // Preserve ID if editing
                const id = window.timelineData[editingIndex].id;
                window.timelineData[editingIndex] = { ...window.timelineData[editingIndex], ...formData, id };
            } else {
                // New ID will be handled by ensureDataIds usually, but let's trust storage on save or add max ID?
                // For now, simple push. IDs might be missing until reload?
                // Ensure ID
                const maxId = window.timelineData.reduce((max, d) => Math.max(max, d.id || 0), 0);
                formData.id = maxId + 1;
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
