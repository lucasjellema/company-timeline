import { formatTooltipDate } from './utils.js';
import { CONFIG } from './config.js';

export class GalleryManager {
    constructor(containerId, storage, tooltipCallbacks) {
        this.containerForVisibility = document.getElementById('tab-gallery');
        this.grid = document.getElementById('gallery-grid');
        this.emptyState = document.getElementById('gallery-empty-state');
        this.storage = storage;
        this.tooltipCallbacks = tooltipCallbacks || {}; // { onHover: fn, onBlur: fn }
        this.currentEvents = [];
    }

    // Check if the gallery tab is currently active/visible
    isVisible() {
        return this.containerForVisibility && this.containerForVisibility.classList.contains('active');
    }

    update(events) {
        // Always store current events so we can re-render if tab becomes active
        this.currentEvents = events;

        if (!this.isVisible()) return;

        this.render();
    }

    render() {
        if (!this.grid) return;

        this.grid.innerHTML = '';

        const eventsWithImages = this.currentEvents.filter(e => e.imageUrl || e.imageId || e.image);
        // Note: Earlier implementation used 'imageUrl' for both URLs and data URI references or logic in map-manager.
        // Let's standardise on checking if we can resolve an image.

        if (eventsWithImages.length === 0) {
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');

        const activeStory = this.storage.getActiveStory();
        const typeIcons = (activeStory && activeStory.settings && activeStory.settings.icons) ? activeStory.settings.icons : {};
        const typeColors = (activeStory && activeStory.settings && activeStory.settings.colors) ? activeStory.settings.colors : CONFIG.TYPE_COLORS;

        eventsWithImages.forEach(e => {
            // Resolve Image URL
            let imgSrc = e.imageUrl;
            if (!imgSrc && e.imageId) {
                // If it's an ID, try to get from storage
                imgSrc = this.storage.getImage(e.imageId);
            }
            // Fallback: If we still don't have a source, skip?
            // User requirement: "This tab shows the images for the events..."
            if (!imgSrc) return;

            // Icon
            const iconName = e.icon || (typeIcons && typeIcons[e.type ? e.type.toLowerCase() : '']);
            const iconPath = (iconName && CONFIG.ICONS[iconName]) ? CONFIG.ICONS[iconName] : null;

            // Color
            const typeKey = e.type ? e.type.toLowerCase() : 'default';
            const color = e.color || typeColors[typeKey] || CONFIG.COLORS.default;

            const item = document.createElement('div');
            item.className = 'gallery-item';

            // Interaction
            item.addEventListener('mouseenter', (domEvent) => {
                if (this.tooltipCallbacks.onHover) this.tooltipCallbacks.onHover(e, domEvent);
            });
            item.addEventListener('mouseleave', () => {
                if (this.tooltipCallbacks.onBlur) this.tooltipCallbacks.onBlur(e.id);
            });

            // HTML Structure
            let iconHtml = '';
            if (iconPath) {
                iconHtml = `
                    <div class="gallery-item-icon" style="color: ${color}; background: rgba(255,255,255,0.05);">
                        <svg viewBox="0 0 24 24"><path d="${iconPath}"></path></svg>
                    </div>
                `;
            } else {
                iconHtml = `
                    <div class="gallery-item-icon" style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%;">
                    </div>
                `;
            }

            const dateStr = formatTooltipDate(e.start || e.startDate, e.end || e.endDate); // Handle differing property names if any

            item.innerHTML = `
                <div class="gallery-item-header">
                    ${iconHtml}
                    <div class="gallery-item-details">
                        <div class="gallery-item-title" title="${e.title}">${e.title}</div>
                        <div class="gallery-item-date">${dateStr}</div>
                    </div>
                </div>
                <div class="gallery-item-image">
                    <img src="${imgSrc}" loading="lazy" alt="${e.title}">
                </div>
            `;

            this.grid.appendChild(item);
        });

        if (this.grid.children.length === 0) {
            this.emptyState.classList.remove('hidden');
        }
    }
}
