import { CONFIG, SAMPLE_CSV } from './config.js';
import { ensureDataIds, generateTypeMappings } from './utils.js';
import { TimelineRenderer } from './renderer.js';
import { TimelineStorage } from './storage.js';
import { MapManager } from './map-manager.js';
import { GalleryManager } from './gallery-manager.js';
import { initSplitter, initTabs, initZoomControls } from './ui-controls.js';
import { initEventEditor } from './event-editor.js';
import { initStoryUI, loadShippedStory, loadStoryFromURL } from './story-ui.js';
import { ThemeManager } from './theme-manager.js';
import { APP_STATE, initializeAuthentication, handleSignIn } from './app-auth.js';
import { TimelineController } from './timeline-controller.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Theme Init
    const themeManager = new ThemeManager();
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => themeManager.toggle());
    }

    // Core Services
    const renderer = new TimelineRenderer('#timeline-viz');
    const storage = new TimelineStorage();

    // Run maintenance
    setTimeout(() => storage.cleanupOrphanedFiles(), 2000); // Delay slightly to avoid blocking init
    renderer.storage = storage; // Attach storage for image retrieval during rendering

    const mapManager = new MapManager('side-panel-map', storage);
    const galleryManager = new GalleryManager('tab-gallery', storage, {
        onHover: (d, e) => {
            renderer.highlightEvent(d.id);
            renderer.handleEventHover(e, d, { hideImage: true });
        },
        onBlur: (id) => {
            renderer.unhighlightEvent(id);
            renderer.tooltip.hide();
        }
    });

    // Controller
    const controller = new TimelineController(renderer, storage, mapManager, galleryManager);

    // --- Init Modules ---

    await initializeAuthentication();

    if (!APP_STATE.initialized) {
        // Optionally handle failure
    }

    controller.init();

    // UI Controls
    let resizeRaf = null;
    initSplitter('timeline-splitter', 'side-panel', mapManager, () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
            if (renderer.layoutData) controller.renderTimeline({ preserveSlider: true });
            resizeRaf = null;
        });
    });

    initZoomControls(renderer);

    const getActiveTab = initTabs('.nav-tab', '.tab-content', (target) => {
        renderer.isMapPanelOpen = (target === 'map');
        if (target === 'map') {
            mapManager.initIfNeeded();
            if (controller.searchState.active && controller.searchState.matches.length > 0) {
                controller.updateMapAndGallery(controller.searchState.matches);
            }
        }
        if (target === 'gallery') {
            galleryManager.render();
        }
    });

    // Editors & Story UI
    // We pass the controller's refreshHandler bound to the controller
    const refreshHandler = (opts) => controller.refreshHandler(opts);

    initEventEditor(renderer, refreshHandler, storage);
    initStoryUI(storage, refreshHandler);


    // --- Initial Load ---
    const urlParams = new URLSearchParams(window.location.search);
    const shippedStoryParam = urlParams.get('shipped_story');
    let loadedFromParam = false;

    if (shippedStoryParam) {
        const stories = CONFIG.SHIPPED_STORIES || [];
        const match = stories.find(s => s.name.toLowerCase().includes(shippedStoryParam.toLowerCase()));

        if (match) {
            console.log("Loading shipped story from param:", match.name);
            loadShippedStory(match, storage, (opts) => {
                controller.searchController.loadEventTypes();
                controller.renderTimeline(opts);
            });
            loadedFromParam = true;
        }
    }

    const storyFileUrlParam = urlParams.get('story_file_url');
    if (!loadedFromParam && storyFileUrlParam) {
        // Auto-login for OneDrive/SharePoint
        if (storyFileUrlParam.includes('sharepoint.com') || storyFileUrlParam.includes('1drv.ms') || storyFileUrlParam.includes('onedrive.live.com')) {
            if (!APP_STATE.authenticated) {
                console.log("OneDrive URL detected, attempting auto-login...");
                try {
                    await handleSignIn(); // Using helper from app-auth
                    await new Promise(r => setTimeout(r, 100));
                } catch (e) {
                    console.warn("Auto-login failed or cancelled", e);
                }
            }
        }

        console.log("Loading story from URL param:", storyFileUrlParam);
        loadStoryFromURL(storyFileUrlParam, storage, (opts) => {
            controller.searchController.loadEventTypes();
            controller.renderTimeline(opts);
        });
        loadedFromParam = true;
    }

    if (!loadedFromParam) {
        const startStory = storage.getActiveStory();
        if (startStory) {
            window.timelineData = startStory.data;
            if (ensureDataIds(window.timelineData)) {
                storage.saveActiveStory(window.timelineData); // Persist IDs
            }
            controller.searchController.loadEventTypes();
            controller.renderTimeline();
        } else {
            const data = d3.csvParse(SAMPLE_CSV);
            ensureDataIds(data);
            const mappings = generateTypeMappings(data, CONFIG.TYPE_COLORS, {});
            storage.createStory("Sample Project Story", data, {
                settings: { colors: mappings.colors, icons: mappings.icons }
            });
            window.timelineData = data;
            controller.searchController.loadEventTypes();
            controller.renderTimeline();
        }
    }

    // Resize Handler
    window.addEventListener('resize', () => {
        if (renderer.layoutData) controller.renderTimeline({ preserveSlider: true });
    });
});