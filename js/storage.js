export class TimelineStorage {
    constructor() {
        this.STORAGE_KEY = 'timeline_app_data';
        this.IMAGE_REPO_KEY = 'timeline-image-repository';
        this.cache = this._loadFromStorage() || {
            activeStoryId: null,
            stories: {}
        };
        this.imageRepoCache = null; // Lazy loaded array of {id, data}
    }

    _loadImageRepo() {
        if (this.imageRepoCache) return;
        try {
            const raw = localStorage.getItem(this.IMAGE_REPO_KEY);
            if (raw) {
                this.imageRepoCache = JSON.parse(raw);
            } else {
                this.imageRepoCache = [];
            }
        } catch (e) {
            console.error("[Storage] Failed to load image repo:", e);
            this.imageRepoCache = [];
        }
    }

    saveImage(dataUrl) {
        this._loadImageRepo();
        const id = 'loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.imageRepoCache.push({ id, data: dataUrl });
        try {
            localStorage.setItem(this.IMAGE_REPO_KEY, JSON.stringify(this.imageRepoCache));
            return id;
        } catch (e) {
            console.error("[Storage] Failed to save image to repo:", e);
            // If quota exceeded, we might want to pop the value back off
            this.imageRepoCache.pop();
            throw e;
        }
    }

    getImage(id) {
        this._loadImageRepo();
        const item = this.imageRepoCache.find(i => i.id === id);
        return item ? item.data : null;
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                console.log("[Storage] Loaded raw data:", raw.substring(0, 50) + "...");
                return JSON.parse(raw);
            }
        } catch (e) {
            console.error("[Storage] Failed to load/parse storage:", e);
        }
        return null;
    }

    _saveToStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
            console.log("[Storage] Written to localStorage successfully. Keys:", Object.keys(this.cache.stories));
        } catch (e) {
            console.error("[Storage] Failed to write to storage:", e);
        }
    }

    getStories() {
        return Object.values(this.cache.stories).map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            lastModified: s.lastModified,
            eventCount: s.data.length
        }));
    }

    createStory(name, data, metadata = {}) {
        const id = 'story_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const story = {
            id,
            name,
            data,
            description: metadata.description || "",
            startDate: metadata.start || null,
            endDate: metadata.end || null,
            settings: metadata.settings || {},
            lastModified: Date.now()
        };
        this.cache.stories[id] = story;
        this.cache.activeStoryId = id; // Auto set active
        this._saveToStorage();
        console.log(`[Storage] Created story: ${name} (${id})`);
        return story;
    }

    getActiveStory() {
        if (!this.cache.activeStoryId) return null;
        return this.cache.stories[this.cache.activeStoryId] || null;
    }

    saveActiveStory(data) {
        if (!this.cache.activeStoryId || !this.cache.stories[this.cache.activeStoryId]) {
            console.warn("[Storage] No active story to save to. Creating fallback.");
            this.createStory("Recovered Story", data);
            return;
        }

        // Clean data: Ensure we only save raw properties, not internal D3 keys or DOM refs
        // We assume data is array of objects.
        const cleanData = data.map(d => {
            // Create shallow copy to strip any non-enumerable or prototype properties if any
            // And explicitly exclude known internal keys if we knew them.
            // For now, object spread is a good way to get "own" properties.
            const obj = { ...d };
            // Note: processTimelineData uses 'startDate', 'endDate' (Date objects).
            // JSON.stringify converts Date to ISO string automatically.
            // But we might want to ensure we don't save 'rowIndex', 'y', 'x' calculated by layout?
            // Layout calculations (rowIndex, y, x) are usually attached to the *events* array in layout-engine,
            // NOT the original data objects if map was used.
            // processTimelineData does `...d`, so it creates NEW objects. 
            // So window.timelineData should be CLEAN unless we pushed dirty objects.
            return obj;
        });

        const story = this.cache.stories[this.cache.activeStoryId];
        story.data = cleanData;
        story.lastModified = Date.now();
        this._saveToStorage();
        console.log(`[Storage] Saved story: ${story.name} with ${cleanData.length} events`);
    }

    updateStorySettings(id, metadata, settings) {
        if (!this.cache.stories[id]) return false;
        const story = this.cache.stories[id];

        if (metadata.name) story.name = metadata.name;
        if (metadata.description !== undefined) story.description = metadata.description;

        // Ensure settings object exists
        if (!story.settings) story.settings = {};

        // Merge provided settings
        if (settings) {
            story.settings = { ...story.settings, ...settings };
        }

        story.lastModified = Date.now();
        this._saveToStorage();
        console.log(`[Storage] Updated settings for story: ${story.name}`);
        return true;
    }

    setActiveStory(id) {
        if (this.cache.stories[id]) {
            this.cache.activeStoryId = id;
            this._saveToStorage();
            return this.cache.stories[id];
        }
        return null;
    }

    importStory(story) {
        if (!story || !story.data) {
            console.error("[Storage] Invalid story object provided for import");
            return false;
        }

        // If story has no ID (legacy/external?), generate one
        if (!story.id) {
            story.id = 'story_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        }

        // Ensure we preserve metadata if it exists in the imported story object
        // The incoming 'story' object replaces the entry, so we just use it directly.
        // But we should ensure it has the expected structure.

        this.cache.stories[story.id] = story;
        this.cache.activeStoryId = story.id;
        this._saveToStorage();
        console.log(`[Storage] Imported story: ${story.name} (${story.id})`);
        return story;
    }

    deleteStory(id) {
        if (!this.cache.stories[id]) return false;

        delete this.cache.stories[id];

        // If we deleted the active story, clear the reference
        if (this.cache.activeStoryId === id) {
            this.cache.activeStoryId = null;
        }

        this._saveToStorage();
        console.log(`[Storage] Deleted story: ${id}`);
        return true;
    }

    cloneStory(id) {
        const sourceStory = this.cache.stories[id];
        if (!sourceStory) return null;

        const newId = 'story_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // Deep copy the story object
        const newStory = JSON.parse(JSON.stringify(sourceStory));

        newStory.id = newId;
        newStory.name = `${sourceStory.name} (Copy)`;
        newStory.lastModified = Date.now();

        this.cache.stories[newId] = newStory;
        this._saveToStorage();

        console.log(`[Storage] Cloned story: ${sourceStory.name} -> ${newStory.name}`);
        return newStory;
    }

    cleanupOrphanedFiles() {
        const LAST_CLEANUP_KEY = 'timeline_last_cleanup';
        const now = Date.now();
        const lastCleanup = parseInt(localStorage.getItem(LAST_CLEANUP_KEY) || '0', 10);
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        if (now - lastCleanup < ONE_DAY_MS) {
            console.log("[Storage] Cleanup skipped (run recently)");
            return;
        }

        console.log("[Storage] Starting cleanup of orphaned files...");
        this._loadImageRepo();

        // 1. Collect all used IDs
        const usedIds = new Set();
        Object.values(this.cache.stories).forEach(story => {
            // Check story metadata if applicable
            if (story.coverImage && story.coverImage.startsWith && story.coverImage.startsWith('loc_')) {
                usedIds.add(story.coverImage);
            }

            // Check events
            if (Array.isArray(story.data)) {
                story.data.forEach(event => {
                    if (event.imageLocalId) {
                        usedIds.add(event.imageLocalId);
                    }
                    // Check generic image URL if it happens to use our scheme
                    if (event.imageUrl && event.imageUrl.startsWith && event.imageUrl.startsWith('loc_')) {
                        usedIds.add(event.imageUrl);
                    }
                });
            }
        });

        // 2. Identify orphans
        const initialCount = this.imageRepoCache.length;
        // Filter: Keep only images that are in use
        this.imageRepoCache = this.imageRepoCache.filter(img => usedIds.has(img.id));
        const finalCount = this.imageRepoCache.length;
        const removedCount = initialCount - finalCount;

        // 3. Save if changes
        if (removedCount > 0) {
            try {
                localStorage.setItem(this.IMAGE_REPO_KEY, JSON.stringify(this.imageRepoCache));
                console.log(`[Storage] Cleaned up ${removedCount} orphaned files.`);
            } catch (e) {
                console.error("[Storage] Failed to save image repo after cleanup:", e);
            }
        } else {
            console.log("[Storage] No orphaned files found.");
        }

        localStorage.setItem(LAST_CLEANUP_KEY, now.toString());
    }
}
