import { initCreateStoryUI } from './story-create.js';
import { initLoadStoryUI } from './story-manage.js';
import { initSettingsUI } from './story-settings.js';
import { initImportExportUI } from './story-import-export.js';
import { initShippedStoriesUI, loadStoryFromURL, loadShippedStory } from './story-load.js';

export function initStoryUI(storage, refreshCallback) {
    initCreateStoryUI(storage, refreshCallback);
    initLoadStoryUI(storage, refreshCallback);
    initSettingsUI(storage, refreshCallback);
    initImportExportUI(storage, refreshCallback);
    initShippedStoriesUI(storage, refreshCallback);
}

// Re-export specific loading functions that might be needed by main.js
export { loadStoryFromURL, loadShippedStory };
