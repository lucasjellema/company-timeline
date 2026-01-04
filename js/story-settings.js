import { CONFIG } from './config.js';
import { parseAndPrepareCSV } from './utils.js';

export function initSettingsUI(storage, refreshCallback) {
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
        document.getElementById('settings-title').value = activeStory.name || '';
        document.getElementById('settings-desc').value = activeStory.description || '';
        document.getElementById('settings-csv-paste').value = ''; // Reset paste field
        renderSettings(activeStory);
    };

    const closeModal = () => modal.classList.add('hidden');

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

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
            { colors: newColors, icons: newIcons }
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
