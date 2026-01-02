export class TimelineStorage {
    constructor() {
        this.STORAGE_KEY = 'timeline_app_data';
        this.cache = this._loadFromStorage() || {
            activeStoryId: null,
            stories: {}
        };
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
}
