export function initSplitter(splitterId, sidePanelId, mapManager, onResize) {
    const splitter = document.getElementById(splitterId);
    const sidePanel = document.getElementById(sidePanelId);

    if (!splitter || !sidePanel) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    splitter.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = sidePanel.getBoundingClientRect().width;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();

        // Add class to body to prevent text selection during drag
        document.body.classList.add('resizing');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const delta = startX - e.clientX;
        const newWidth = startWidth + delta;
        const maxWidth = window.innerWidth * 0.8;

        if (newWidth > 250 && newWidth < maxWidth) {
            sidePanel.style.width = `${newWidth}px`;

            // Adjust map height to keep aspect ratio
            const mapContainer = document.querySelector('.side-map-container');
            if (mapContainer) {
                mapContainer.style.height = `${newWidth * 0.75}px`;
            }

            if (mapManager) mapManager.invalidateSize();
            if (onResize) onResize();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.classList.remove('resizing');
        }
    });
}

export function initTabs(tabsSelector, contentSelector, onTabChange) {
    const tabs = document.querySelectorAll(tabsSelector);
    const tabContents = document.querySelectorAll(contentSelector);
    let activeTabId = 'events';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            activeTabId = target;

            // Update UI
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
            tabContents.forEach(c => c.classList.toggle('active', c.id === `tab-${target}`));

            if (onTabChange) onTabChange(target);
        });
    });
    return () => activeTabId; // return accessor
}

export function initZoomControls(renderer) {
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');

    if (zoomIn) zoomIn.addEventListener('click', () => renderer.zoom(0.5));
    if (zoomOut) zoomOut.addEventListener('click', () => renderer.zoom(-0.5));
}
