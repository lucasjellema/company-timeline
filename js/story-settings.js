import { CONFIG } from './config.js';
import { parseAndPrepareCSV } from './utils.js';

export function initSettingsUI(storage, refreshCallback) {
    const modal = document.getElementById('story-settings-modal');
    const openBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const cancelBtn = document.getElementById('cancel-settings-btn');
    const form = document.getElementById('story-settings-form');
    const colorContainer = document.getElementById('color-settings-container');

    // Location UI Refs
    const locSearchInput = document.getElementById('settings-loc-search');
    const locSearchBtn = document.getElementById('settings-loc-search-btn');
    const locSearchResults = document.getElementById('settings-loc-search-results');
    const locNameInput = document.getElementById('settings-loc-name');
    const locDescInput = document.getElementById('settings-loc-desc');
    const locLatInput = document.getElementById('settings-loc-lat');
    const locLngInput = document.getElementById('settings-loc-lng');
    const locIdInput = document.getElementById('settings-loc-id');
    const locAddBtn = document.getElementById('settings-loc-add-btn');
    const locListContainer = document.getElementById('settings-locations-list');
    const locShowAllBtn = document.getElementById('settings-loc-show-all');

    let settingsMap = null;
    let settingsMarker = null;
    let settingsLayerGroup = null; // For "Show All" markers
    let currentLocations = []; // Transient state

    const openModal = () => {
        const activeStory = storage.getActiveStory();
        if (!activeStory) {
            alert("No active story to configure.");
            return;
        }
        modal.classList.remove('hidden');
        document.getElementById('settings-title').value = activeStory.name || '';
        document.getElementById('settings-desc').value = activeStory.description || '';
        document.getElementById('settings-csv-paste').value = '';

        // Deep copy locations to avoid mutation before save
        currentLocations = (activeStory.settings && activeStory.settings.locations)
            ? JSON.parse(JSON.stringify(activeStory.settings.locations))
            : [];

        renderSettings(activeStory);
        renderLocationsList();
        clearLocationForm();

        // Timeout to allow modal to render before init map, but we lazily init on collapse expand
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        if (settingsMap) {
            settingsMap.remove();
            settingsMap = null;
            settingsMarker = null;
            settingsLayerGroup = null;
        }
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Setup collapsible sections
    const collapsibles = form.querySelectorAll('.collapsible-section');
    collapsibles.forEach(section => {
        const header = section.querySelector('.collapsible-header');
        if (header) {
            header.addEventListener('click', () => {
                section.classList.toggle('collapsed');
                // Lazy init map if locations section is opened
                if (section.id === 'settings-locations-collapsible' && !section.classList.contains('collapsed')) {
                    setTimeout(() => initSettingsMap(), 200);
                }
            });
        }
    });

    // --- Location Logic ---

    function initSettingsMap() {
        if (settingsMap) {
            settingsMap.invalidateSize();
            return;
        }
        if (typeof L === 'undefined') return;

        settingsMap = L.map('settings-map').setView([20, 0], 2);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>'
        }).addTo(settingsMap);

        settingsLayerGroup = L.layerGroup().addTo(settingsMap);

        settingsMap.on('click', function (e) {
            const { lat, lng } = e.latlng;
            updateSettingsMap(lat, lng);
        });
    }

    function updateSettingsMap(lat, lng) {
        if (!settingsMap) initSettingsMap();

        lat = parseFloat(lat);
        lng = parseFloat(lng);

        if (isNaN(lat) || isNaN(lng)) return;

        // Clear "Show All" layers if we are focusing on one
        if (settingsLayerGroup) settingsLayerGroup.clearLayers();

        if (settingsMarker) settingsMap.removeLayer(settingsMarker);

        // Marker options
        const opts = {};
        const nameVal = locNameInput.value.trim();

        const descVal = locDescInput.value.trim();
        if (descVal) opts.title = descVal; // Set hover tooltip

        settingsMarker = L.marker([lat, lng], opts).addTo(settingsMap);

        if (nameVal) {
            settingsMarker.bindTooltip(nameVal, { permanent: true, direction: 'bottom', className: 'map-label-tooltip' });
        }

        settingsMap.setView([lat, lng], 10);

        locLatInput.value = lat.toFixed(6);
        locLngInput.value = lng.toFixed(6);
    }

    // Show All Logic
    if (locShowAllBtn) {
        locShowAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentLocations.length) {
                alert("No locations to show.");
                return;
            }
            if (!settingsMap) initSettingsMap();

            // Clear single marker
            if (settingsMarker) settingsMap.removeLayer(settingsMarker);
            settingsMarker = null; // Clear ref so next click creates new one cleanly

            // Clear existing group
            if (settingsLayerGroup) settingsLayerGroup.clearLayers();

            const bounds = L.latLngBounds();

            currentLocations.forEach(loc => {
                const marker = L.marker([loc.lat, loc.lng], { title: loc.description || loc.name });
                marker.bindTooltip(loc.name, { permanent: true, direction: 'bottom', className: 'map-label-tooltip' });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    locNameInput.value = loc.name;
                    locDescInput.value = loc.description || '';
                    locIdInput.value = loc.id;
                    updateSettingsMap(loc.lat, loc.lng);
                });

                settingsLayerGroup.addLayer(marker);
                bounds.extend([loc.lat, loc.lng]);
            });

            settingsMap.fitBounds(bounds, { padding: [50, 50] });
        });
    }

    function clearLocationForm() {
        locNameInput.value = '';
        locDescInput.value = '';
        locLatInput.value = '';
        locLngInput.value = '';
        locIdInput.value = '';
        locSearchInput.value = '';
        if (settingsMarker && settingsMap) {
            settingsMap.removeLayer(settingsMarker);
            settingsMarker = null;
        }
        if (settingsLayerGroup) settingsLayerGroup.clearLayers();
        if (locSearchResults) {
            locSearchResults.innerHTML = '';
            locSearchResults.classList.add('hidden');
        }
    }

    // Map Hover State
    let isSettingsMapHovered = false;
    const settingsMapContainer = document.getElementById('settings-map');
    if (settingsMapContainer) {
        settingsMapContainer.addEventListener('mouseenter', () => isSettingsMapHovered = true);
        settingsMapContainer.addEventListener('mouseleave', () => isSettingsMapHovered = false);
    }

    // Global Paste Listener (for Map)
    document.addEventListener('paste', (e) => {
        if (!isSettingsMapHovered) return;
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        handleCoordPaste(pastedText, e);
    });

    function handleCoordPaste(text, e) {
        if (text && text.includes(',')) {
            const parts = text.split(',');
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
                if (e) e.preventDefault();

                // Clear ID to ensure new location creation
                locIdInput.value = '';
                // Optional: Clear Name/Desc to avoid confusion? 
                // User said "create a new location", implying a fresh start.
                // Converting to new location mode implies we might want to clear old data
                // or keep it as a template? "do not overwrite" implies safety.
                // Let's explicitly clear name to be safe and indicate "New".
                // locNameInput.value = ''; // Let's keep it empty or maybe "New Location"?
                // Actually, if I pasted on map, I expect the pin to move.
                // If I had "London" selected, and I paste NY coords, 
                // if I click Add, it should stay "London" or be "New"?
                // "create a new location" request implies: don't edit the old ID.
                // So clearing ID is the most critical part. 
                // If I keep the name "London" it might be confusing. 
                // Let's clear the name to signal "New Input Needed".
                // But if they pasted into search box, maybe they want to search?
                // The search box paste handler calls this too.

                // Re-reading user: "create a new location, do not overwrite the currenty edited one"
                // This means unbind the ID.
                locIdInput.value = '';

                updateSettingsMap(lat, lng);

                // If the search input initiated this, update it too
                if (document.activeElement === locSearchInput) {
                    locSearchInput.value = text;
                }
            }
        }
    }

    // Search Logic
    if (locSearchBtn && locSearchInput) {
        // Paste support
        locSearchInput.addEventListener('paste', (e) => {
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            handleCoordPaste(pastedText, e);
        });

        locSearchBtn.addEventListener('click', () => {
            const query = locSearchInput.value.trim();
            if (!query) return;

            // Check diff coords
            if (query.includes(',')) {
                const parts = query.split(',');
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    updateSettingsMap(lat, lng);
                    return;
                }
            }

            locSearchBtn.disabled = true;
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=5`)
                .then(res => res.json())
                .then(data => {
                    renderLocSearchResults(data);
                })
                .finally(() => locSearchBtn.disabled = false);
        });
    }

    // Filter Logic
    const locFilterInput = document.getElementById('settings-loc-filter');
    if (locFilterInput) {
        locFilterInput.addEventListener('input', () => {
            renderLocationsList();
        });
    }

    function renderLocSearchResults(data) {
        if (!data || data.length === 0) {
            locSearchResults.innerHTML = '<div style="padding:8px; color:var(--text-muted);">No results found.</div>';
            locSearchResults.classList.remove('hidden');
            return;
        }
        locSearchResults.innerHTML = data.map(item => `
            <div class="geo-result-item" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${item.display_name.replace(/"/g, '&quot;')}" 
                 style="padding:8px; border-bottom:1px solid var(--border); cursor:pointer;">
                <div style="font-weight:500; font-size:0.9rem;">${item.name || item.display_name.split(',')[0]}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.display_name}</div>
            </div>
        `).join('');
        locSearchResults.classList.remove('hidden');

        locSearchResults.querySelectorAll('.geo-result-item').forEach(el => {
            el.addEventListener('click', () => {
                const lat = parseFloat(el.dataset.lat);
                const lng = parseFloat(el.dataset.lon);
                updateSettingsMap(lat, lng);
                locNameInput.value = el.dataset.name.split(',')[0];
                locSearchResults.classList.add('hidden');
            });
        });
    }

    function updateSettingsMap(lat, lng) {
        if (!settingsMap) initSettingsMap();

        lat = parseFloat(lat);
        lng = parseFloat(lng);

        if (isNaN(lat) || isNaN(lng)) return;

        if (settingsMarker) settingsMap.removeLayer(settingsMarker);

        // Marker options
        const opts = {};
        const nameVal = locNameInput.value.trim();

        const descVal = locDescInput.value.trim();
        if (descVal) opts.title = descVal; // Set hover tooltip

        settingsMarker = L.marker([lat, lng], opts).addTo(settingsMap);

        if (nameVal) {
            settingsMarker.bindTooltip(nameVal, { permanent: true, direction: 'bottom', className: 'map-label-tooltip' });
        }

        settingsMap.setView([lat, lng], 10);

        locLatInput.value = lat.toFixed(6);
        locLngInput.value = lng.toFixed(6);
    }

    // Wire name input to map marker update
    if (locNameInput) {
        locNameInput.addEventListener('input', () => {
            const lat = parseFloat(locLatInput.value);
            const lng = parseFloat(locLngInput.value);
            if (!isNaN(lat) && !isNaN(lng)) {
                updateSettingsMap(lat, lng);
            }
        });
    }

    // Add/Update Logic
    if (locAddBtn) {
        locAddBtn.addEventListener('click', () => {
            const name = locNameInput.value.trim();
            if (!name) {
                alert('Location name is required.');
                return;
            }
            if (!locLatInput.value || !locLngInput.value) {
                alert('Please select a location on the map.');
                return;
            }

            const locData = {
                id: locIdInput.value || crypto.randomUUID(),
                name: name,
                description: locDescInput.value.trim(),
                lat: parseFloat(locLatInput.value),
                lng: parseFloat(locLngInput.value)
            };

            const existingIdx = currentLocations.findIndex(l => l.id === locData.id);
            if (existingIdx >= 0) {
                currentLocations[existingIdx] = locData;
            } else {
                currentLocations.push(locData);
            }

            // Ensure visual update immediately
            updateSettingsMap(locData.lat, locData.lng);

            renderLocationsList();
            clearLocationForm();
        });
    }

    function renderLocationsList() {
        let displayList = [...currentLocations];

        // Sorting (Name)
        displayList.sort((a, b) => a.name.localeCompare(b.name));

        // Filtering
        if (locFilterInput) {
            const term = locFilterInput.value.toLowerCase();
            if (term) {
                displayList = displayList.filter(l => l.name.toLowerCase().includes(term));
            }
        }

        if (!displayList.length) {
            locListContainer.innerHTML = '<div class="empty-state" style="padding:1rem; text-align:center; color:var(--text-muted);">No locations found.</div>';
            return;
        }

        locListContainer.innerHTML = displayList.map(loc => `
            <div class="location-item" style="padding:0.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <div title="${loc.description || loc.name}">
                    <div style="font-weight:500;">${loc.name}</div>
                    <!-- Coordinates removed from view per request -->
                </div>
                <div style="display:flex; gap:0.25rem;">
                     <button type="button" class="btn-icon edit-loc-btn" data-id="${loc.id}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                     </button>
                     <button type="button" class="btn-icon delete-loc-btn" data-id="${loc.id}" title="Delete" style="color:var(--danger);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                     </button>
                </div>
            </div>
        `).join('');

        // Bind Edit/Delete
        locListContainer.querySelectorAll('.edit-loc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const loc = currentLocations.find(l => l.id === id);
                if (loc) {
                    locNameInput.value = loc.name;
                    locDescInput.value = loc.description || '';
                    locIdInput.value = loc.id;
                    updateSettingsMap(loc.lat, loc.lng);
                    document.getElementById('settings-locations-container').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        locListContainer.querySelectorAll('.delete-loc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this location?')) {
                    const id = btn.dataset.id;
                    currentLocations = currentLocations.filter(l => l.id !== id);
                    renderLocationsList();
                }
            });
        });
    }

    // --- End Location Logic ---

    function renderSettings(story) {
        colorContainer.innerHTML = '';
        colorContainer.className = 'color-settings-list';

        const defaultTypes = Object.keys(CONFIG.TYPE_COLORS).filter(k => k !== 'default');
        const dataTypes = [...new Set(window.timelineData.map(d => d.type ? d.type.toLowerCase() : "").filter(Boolean))];
        const allTypes = [...new Set([...defaultTypes, ...dataTypes])].sort();

        const currentColors = (story.settings && story.settings.colors) ? story.settings.colors : {};
        const currentIcons = (story.settings && story.settings.icons) ? story.settings.icons : {};

        allTypes.forEach(type => {
            const defaultColor = CONFIG.TYPE_COLORS[type] || CONFIG.COLORS.default;
            const savedColor = currentColors[type] || defaultColor;
            const savedIcon = currentIcons[type] || '';

            const wrapper = document.createElement('div');
            wrapper.className = 'color-item';

            const getIconSvg = (name) => {
                const path = CONFIG.ICONS[name];
                return path ? `<svg class="select-icon-svg" viewBox="0 0 24 24"><path d="${path}"></path></svg>` : '';
            };

            const iconKeys = Object.keys(CONFIG.ICONS).sort();

            wrapper.innerHTML = `
                <span class="color-label">${type}</span>
                <div class="custom-select" id="custom-select-${type}">
                    <div class="select-selected">
                            ${savedIcon ? getIconSvg(savedIcon) : ''} <span>${savedIcon || 'No Icon'}</span>
                    </div>
                    <div class="select-items select-hide">
                            <div class="icon-search-box" style="position: sticky; top: 0; background-color: var(--bg-card); z-index: 10; cursor: default; padding: 6px 8px;">
                                <input type="text" placeholder="Search icons..." style="width: 100%; padding: 4px; box-sizing: border-box; background: rgba(255,255,255,0.1); border: 1px solid var(--border); color: var(--text-main); border-radius: 4px; font-size: 0.8rem;">
                            </div>
                            <div class="select-option" data-value="">No Icon</div>
                            ${iconKeys.map(k => `
                                <div class="select-option" data-value="${k}">
                                    ${getIconSvg(k)} <span>${k}</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
                <input type="hidden" name="icon-${type}" value="${savedIcon}" class="icon-input-hidden">
                <div class="color-preview" style="background-color: ${savedColor};"></div>
                <label class="color-edit-icon" title="Change Color">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    <input type="color" name="color-${type}" value="${savedColor}" class="color-input-hidden-picker" style="display:none;">
                </label>
            `;

            const input = wrapper.querySelector('input[type="color"]');
            const preview = wrapper.querySelector('.color-preview');
            const label = wrapper.querySelector('.color-edit-icon');

            input.addEventListener('input', (e) => preview.style.backgroundColor = e.target.value);

            // Custom Select Logic
            const customSelect = wrapper.querySelector('.custom-select');
            const selectedDiv = customSelect.querySelector('.select-selected');
            const itemsDiv = customSelect.querySelector('.select-items');
            const hiddenInput = wrapper.querySelector('.icon-input-hidden');
            const searchBox = itemsDiv.querySelector('.icon-search-box');
            const searchInput = searchBox.querySelector('input');

            selectedDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllSelect(selectedDiv);
                itemsDiv.classList.toggle('select-hide');
                selectedDiv.classList.toggle('select-arrow-active');
                // Focus search when opening
                if (!itemsDiv.classList.contains('select-hide')) {
                    setTimeout(() => searchInput.focus(), 100);
                }
            });

            // Prevent closing when clicking search box
            searchBox.addEventListener('click', (e) => e.stopPropagation());

            // Filter functionality
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                itemsDiv.querySelectorAll('.select-option').forEach(option => {
                    const text = option.textContent.toLowerCase().trim();
                    if (text.includes(term)) {
                        option.style.display = ""; // Reset to CSS default (flex)
                    } else {
                        option.style.display = "none";
                    }
                });
            });

            itemsDiv.querySelectorAll('.select-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = option.getAttribute('data-value');
                    const svgHtml = val ? getIconSvg(val) : '';
                    selectedDiv.innerHTML = `${svgHtml} <span>${val || 'No Icon'}</span>`;
                    hiddenInput.value = val;
                    itemsDiv.classList.add('select-hide');
                    selectedDiv.classList.remove('select-arrow-active');
                });
            });

            colorContainer.appendChild(wrapper);
        });

        document.addEventListener('click', closeAllSelect);
    }

    function closeAllSelect(elm) {
        const items = document.getElementsByClassName("select-items");
        const selected = document.getElementsByClassName("select-selected");
        for (let i = 0; i < selected.length; i++) {
            if (elm !== selected[i]) selected[i].classList.remove("select-arrow-active");
        }
        for (let i = 0; i < items.length; i++) {
            // Logic to close other dropdowns
            if (!elm || !elm.parentNode.parentNode.contains(items[i])) { // check parent wrapper
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

        const newColors = {};
        colorContainer.querySelectorAll('input[type="color"]').forEach(input => {
            newColors[input.name.replace('color-', '')] = input.value;
        });

        const newIcons = {};
        colorContainer.querySelectorAll('input.icon-input-hidden').forEach(input => {
            if (input.value) newIcons[input.name.replace('icon-', '')] = input.value;
        });

        storage.updateStorySettings(activeStory.id,
            { name: newName, description: newDesc },
            { colors: newColors, icons: newIcons, locations: currentLocations }
        );

        // Handle CSV Import
        const csvPaste = document.getElementById('settings-csv-paste').value;
        if (csvPaste && csvPaste.trim()) {
            try {
                const newEvents = parseAndPrepareCSV(csvPaste);
                if (newEvents.length > 0) {
                    const currentData = activeStory.data || [];
                    const mergedData = [...currentData, ...newEvents];
                    storage.saveActiveStory(mergedData);
                    window.timelineData = mergedData; // Update global state
                    alert(`Imported ${newEvents.length} events.`);
                }
            } catch (err) {
                alert(err.message);
                return; // Don't close modal if error? or maybe just warn
            }
        }

        closeModal();
        refreshCallback({ preserveSlider: true });
    });
}
