import { formatTooltipDate } from './utils.js';
import { CONFIG } from './config.js';

export class MapManager {
    constructor(mapContainerId) {
        this.mapContainerId = mapContainerId;
        this.map = null;
        this.markers = [];
        this.initResetButton();
    }

    initResetButton() {
        // Handler for reset, assuming button exists
        const btn = document.getElementById('reset-map-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.clearMarkers();
            });
        }
    }

    initIfNeeded() {
        if (this.map) {
            setTimeout(() => this.map.invalidateSize(), 100);
            return;
        }

        const mapContainer = document.getElementById(this.mapContainerId);
        if (!mapContainer) return;

        // Set initial height based on current width if not set
        if (!mapContainer.style.height) {
            const width = mapContainer.clientWidth || 300;
            mapContainer.style.height = `${width * 0.75}px`;
        }

        if (typeof L === 'undefined') {
            console.error("Leaflet (L) not loaded");
            return;
        }

        this.map = L.map(this.mapContainerId).setView([20, 0], 2);
        // Use Light tiles for better visibility
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(this.map);
    }

    addEventPin(d, shouldPan = false, callbacks = {}, typeIcons = {}) {
        if (!this.map) this.initIfNeeded();

        const lat = parseFloat(d.lattitude || d.latitude);
        const lng = parseFloat(d.longitude || d.longtitude);

        if (isNaN(lat) || isNaN(lng)) return;

        const marker = L.marker([lat, lng]).addTo(this.map);

        const iconName = typeIcons && typeIcons[d.type ? d.type.toLowerCase() : ''];
        const iconPath = (iconName && CONFIG.ICONS[iconName]) ? CONFIG.ICONS[iconName] : null;

        const iconHtml = iconPath ?
            `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: sub; margin-right: 6px; fill: currentColor;"><path d="${iconPath}"></path></svg>` :
            '';

        marker.bindPopup(`
            <strong>${iconHtml}${d.title}</strong><br>
            Type: ${d.type}<br>
            ${formatTooltipDate(d.start, d.end)}<br>
            <div style="font-size:0.9em; margin-top:4px">${d.description || ''}</div>
         `);

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

        this.markers.push(marker);
        return [lat, lng];
    }

    clearMarkers() {
        if (!this.map) return;
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
    }

    fitBounds(points) {
        if (this.map && points.length > 0) {
            this.map.fitBounds(points, { padding: [50, 50], maxZoom: 10, animate: true, duration: 0.5 });
        }
    }

    invalidateSize() {
        if (this.map) this.map.invalidateSize();
    }
}
