import { formatTooltipDate, formatCompactDate } from './utils.js';
import { CONFIG } from './config.js';

export class MapManager {
    constructor(mapContainerId, storage) {
        this.mapContainerId = mapContainerId;
        this.storage = storage; // Store reference to storage
        this.map = null;
        this.markers = []; // Array of { marker, data, typeIcons }
        this.useEventIcons = false;
        this.showLabels = true;
        this.initResetButton();
        this.initToggle();
        this.initLabelToggle();
        this.initPopOut();
    }

    initResetButton() {
        const btn = document.getElementById('reset-map-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.clearMarkers();
            });
        }
    }

    initToggle() {
        const toggle = document.getElementById('map-marker-toggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.useEventIcons = e.target.checked;
                this.refreshMarkers();
            });
        }
    }

    initLabelToggle() {
        const toggle = document.getElementById('map-label-toggle');
        if (toggle) {
            this.showLabels = toggle.checked; // Sync initial state
            toggle.addEventListener('change', (e) => {
                this.showLabels = e.target.checked;
                this.updateLabelVisibility();
            });
        }
    }

    initPopOut() {
        const popOutBtn = document.getElementById('pop-out-map-btn');
        const modal = document.getElementById('full-map-modal');
        const closeBtn = document.getElementById('close-map-modal-btn');
        const modalBody = document.getElementById('full-map-modal-body');
        const mapContainer = document.getElementById(this.mapContainerId);

        if (!popOutBtn || !modal || !closeBtn || !modalBody || !mapContainer) return;

        // Store original parent to return to
        // If mapContainer has a parent, use it. If not (unlikely), error.
        // We'll rely on appending back to the known container ID or simply the previous parent.
        // Better: Find the parent by ID if possible, or just store reference.
        // The parent in HTML is class "tab-content" id="tab-map", but specifically it is after header.
        // Actually, we can just insertBefore the next sibling.

        let originalParent = mapContainer.parentNode;
        let originalNextSibling = mapContainer.nextSibling;

        const openModal = () => {
            // Re-capture parent/sibling just in case
            originalParent = mapContainer.parentNode;
            originalNextSibling = mapContainer.nextSibling;

            modal.classList.remove('hidden');
            modalBody.appendChild(mapContainer);
            mapContainer.classList.add('fullscreen');

            // Force leaflet resize and fit bounds
            setTimeout(() => {
                if (this.map) {
                    this.map.invalidateSize();

                    // Zoom to fit all markers
                    const points = this.markers.map(m => m.marker.getLatLng());
                    if (points.length > 0) {
                        this.map.fitBounds(points, {
                            padding: [50, 50],
                            maxZoom: 18,
                            animate: true,
                            duration: 0.5
                        });
                    }
                }
            }, 50);
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            mapContainer.classList.remove('fullscreen');

            // Move back
            if (originalParent) {
                originalParent.insertBefore(mapContainer, originalNextSibling);
            }

            setTimeout(() => {
                if (this.map) this.map.invalidateSize();
            }, 50);
        };

        popOutBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    initIfNeeded() {
        if (this.map) {
            setTimeout(() => this.map.invalidateSize(), 100);
            return;
        }

        const mapContainer = document.getElementById(this.mapContainerId);
        if (!mapContainer) return;

        if (!mapContainer.style.height) {
            const width = mapContainer.clientWidth || 300;
            mapContainer.style.height = `${width * 0.75}px`;
        }

        if (typeof L === 'undefined') {
            console.error("Leaflet (L) not loaded");
            return;
        }

        this.map = L.map(this.mapContainerId).setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(this.map);
    }

    createMarker(d, typeIcons, typeColors) {
        const lat = parseFloat(d.lattitude || d.latitude);
        const lng = parseFloat(d.longitude || d.longtitude);

        if (isNaN(lat) || isNaN(lng)) return null;

        let marker;
        const iconName = d.icon || (typeIcons && typeIcons[d.type ? d.type.toLowerCase() : '']);
        // Fix: Ensure we check CONFIG.ICONS properly if we had access to it, 
        // but here we rely on what was passed or access global CONFIG if imported.
        // The original code accessed CONFIG.ICONS.
        const iconPath = (iconName && CONFIG.ICONS[iconName]) ? CONFIG.ICONS[iconName] : null;

        if (this.useEventIcons && iconPath) {
            const typeKey = d.type ? d.type.toLowerCase() : '';
            const color = d.color || (typeColors && typeColors[typeKey]) || (CONFIG.TYPE_COLORS && CONFIG.TYPE_COLORS[typeKey]) || 'var(--primary)';

            const iconHtml = `
                <div style="
                    background-color: ${color};
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    border: 2px solid white;
                ">
                    <svg viewBox="0 0 24 24" width="18" height="18" style="fill: white;">
                        <path d="${iconPath}"></path>
                    </svg>
                </div>
            `;

            const customIcon = L.divIcon({
                className: 'custom-event-marker',
                html: iconHtml,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -15]
            });

            marker = L.marker([lat, lng], { icon: customIcon });
        } else {
            marker = L.marker([lat, lng]);
        }

        const iconHtmlForPopup = iconPath ?
            `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: sub; margin-right: 6px; fill: currentColor;"><path d="${iconPath}"></path></svg>` :
            '';

        let imgSrc = null;
        if (d.imageLocalId && this.storage) {
            imgSrc = this.storage.getImage(d.imageLocalId);
        }
        if (!imgSrc && d.imageUrl) {
            imgSrc = d.imageUrl;
        }

        const imageIconHtml = imgSrc ? `
            <div class="map-popup-footer">
                <div class="map-popup-image-wrapper">
                     <div class="map-popup-image-preview">
                        <img src="${imgSrc}" style="width: 100%; display: block; border-radius: 2px;">
                     </div>
                     <div class="map-popup-icon" title="View Image">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                     </div>
                </div>
            </div>
        ` : '';

        marker.bindPopup(`
            <strong>${iconHtmlForPopup}${d.title}</strong><br>
            Type: ${d.type}
            ${d.parentContext ? ` (${d.parentContext})` : ''}<br>
            ${formatTooltipDate(d.start, d.end)}<br>
            <div style="font-size:0.9em; margin-top:4px">${d.description || ''}</div>
            ${imageIconHtml}
         `);

        const compactDate = formatCompactDate(d.start) + (d.end ? ` - ${formatCompactDate(d.end)}` : '');
        const labelText = compactDate ? `${d.title} (${compactDate})` : d.title;

        marker.bindTooltip(labelText, {
            permanent: true,
            direction: "bottom",
            offset: [0, 15],
            className: 'map-event-label'
        });

        // Close it immediately if labels should be hidden


        return marker;
    }

    refreshMarkers() {
        if (!this.map) return;

        // Remove current markers from map but keep data
        this.markers.forEach(item => {
            if (item.marker) this.map.removeLayer(item.marker);
        });

        // Recreate markers
        this.markers.forEach(item => {
            const newMarker = this.createMarker(item.data, item.typeIcons, item.typeColors);
            if (newMarker) {
                // Restore event listeners
                newMarker.on('mouseover', () => {
                    newMarker.openPopup();
                    if (item.callbacks && item.callbacks.onHover) item.callbacks.onHover(item.data.id);
                });
                newMarker.on('mouseout', () => {
                    if (item.callbacks && item.callbacks.onBlur) item.callbacks.onBlur(item.data.id);
                });

                newMarker.addTo(this.map);
                if (!this.showLabels) newMarker.closeTooltip();
                item.marker = newMarker;
            }
        });
    }

    addEventPin(d, shouldPan = false, callbacks = {}, typeIcons = {}, typeColors = {}) {
        if (!this.map) this.initIfNeeded();

        const lat = parseFloat(d.lattitude || d.latitude);
        const lng = parseFloat(d.longitude || d.longtitude);

        if (isNaN(lat) || isNaN(lng)) return;

        const marker = this.createMarker(d, typeIcons, typeColors);
        if (!marker) return;

        marker.addTo(this.map);
        if (!this.showLabels) marker.closeTooltip();

        marker.on('mouseover', function (e) {
            this.openPopup();
            if (callbacks.onHover) callbacks.onHover(d.id);
        });

        marker.on('mouseout', function (e) {
            if (callbacks.onBlur) callbacks.onBlur(d.id);
        });

        if (shouldPan) {
            this.map.flyTo([lat, lng], Math.max(this.map.getZoom(), 6), { duration: 1 });
        }

        this.markers.push({ marker, data: d, typeIcons, typeColors, callbacks });
        return [lat, lng];
    }

    clearMarkers() {
        if (!this.map) return;
        this.markers.forEach(item => {
            if (item.marker) this.map.removeLayer(item.marker);
        });
        this.markers = [];
    }

    fitBounds(points) {
        if (this.map && points.length > 0) {
            this.map.fitBounds(points, { padding: [50, 50], maxZoom: 10, animate: true, duration: 0.5 });
        }
    }

    updateLabelVisibility() {
        this.markers.forEach(item => {
            if (item.marker) {
                if (this.showLabels) {
                    item.marker.openTooltip();
                } else {
                    item.marker.closeTooltip();
                }
            }
        });
    }

    invalidateSize() {
        if (this.map) this.map.invalidateSize();
    }
}
