import { TimelineStorage } from './storage.js';
import { initSettingsUI } from './story-settings.js';
import { CONFIG } from './config.js';
import { ensureDataIds } from './utils.js';

export function initStoryUI(storage, refreshCallback) {
    initCreateStoryUI(storage, refreshCallback);
    initLoadStoryUI(storage, refreshCallback);
    initSettingsUI(storage, refreshCallback);
    initImportExportUI(storage, refreshCallback);
    initShippedStoriesUI(storage, refreshCallback);
}

function initShippedStoriesUI(storage, refreshCallback) {
    const modal = document.getElementById('shipped-stories-modal');
    const closeBtn = document.getElementById('close-shipped-modal-btn');
    const listContainer = document.getElementById('shipped-story-list');
    const browseBtn = document.getElementById('browse-shipped-btn');
    const loadModal = document.getElementById('load-story-modal');

    // Open from Load Modal
    if (browseBtn) {
        browseBtn.addEventListener('click', () => {
            loadModal.classList.add('hidden');
            modal.classList.remove('hidden');
            renderShippedList();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // Close on overlay click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    const renderShippedList = () => {
        const stories = CONFIG.SHIPPED_STORIES || [];
        if (stories.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No shipped stories found.</div>';
            return;
        }

        listContainer.innerHTML = stories.map((s, idx) => `
            <li class="story-item" data-idx="${idx}">
                <div class="story-info">
                    <div class="story-title">${s.name}</div>
                    <div class="story-desc">${s.description || ''}</div>
                </div>
                <button class="btn btn-sm btn-primary import-btn" data-idx="${idx}">Import</button>
            </li>
        `).join('');

        listContainer.querySelectorAll('.import-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                importAndLoad(stories[e.target.dataset.idx]);
            });
        });

        listContainer.querySelectorAll('.story-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                importAndLoad(stories[item.dataset.idx]);
            });
        });
    };

    const importAndLoad = async (storyConfig) => {
        try {
            const res = await fetch(`data/${storyConfig.file}`);
            if (!res.ok) throw new Error(`Failed to load ${storyConfig.file}`);
            let data = await res.json();

            // Handle wrapper if present (e.g. if file is { story: { ... } } or just { ... })
            // Assuming the file IS the story object or an array of events.

            let storyObj;

            if (Array.isArray(data)) {
                // Raw Events Array
                ensureDataIds(data);
                storyObj = {
                    name: storyConfig.name,
                    description: storyConfig.description,
                    data: data
                };
                // Allow storage to create
                storage.createStory(storyObj.name, storyObj.data, { description: storyObj.description });
            } else {
                // Full Story Object
                storyObj = data;
                // Force new ID to treat as template import
                storyObj.id = null;
                // Ensure name/desc if missing
                if (!storyObj.name) storyObj.name = storyConfig.name;
                if (!storyObj.description) storyObj.description = storyConfig.description;

                storage.importStory(storyObj);
            }

            // Activate
            // storage.createStory and importStory both set the active ID internally.
            // We just need to load the data into global state and refresh.
            // But wait, createStory returns the story object. importStory returns it too.
            // So we can just use the memory object or fetch active.

            const activeStory = storage.getActiveStory();
            window.timelineData = activeStory.data;
            refreshCallback({ resetView: true });

            modal.classList.add('hidden');

        } catch (err) {
            console.error(err);
            alert("Failed to load story: " + err.message);
        }
    };
}

function initCreateStoryUI(storage, refreshCallback) {
    const modal = document.getElementById('create-story-modal');
    const openBtn = document.getElementById('create-story-btn');
    const closeBtn = document.getElementById('close-story-modal-btn');
    const cancelBtn = document.getElementById('cancel-story-btn');
    const form = document.getElementById('create-story-form');

    const openModal = () => {
        modal.classList.remove('hidden');
        const now = new Date();
        if (!document.getElementById('story-start').value) {
            document.getElementById('story-start').value = now.getFullYear();
            document.getElementById('story-end').value = now.getFullYear() + 1;
        }
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        form.reset();
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('story-title-input').value;
        const start = document.getElementById('story-start').value;
        const end = document.getElementById('story-end').value;
        const desc = document.getElementById('story-desc').value;

        storage.createStory(title, [], { description: desc, start, end });
        window.timelineData = [];

        refreshCallback({ resetView: true });
        closeModal();
    });
}

function initLoadStoryUI(storage, refreshCallback) {
    const modal = document.getElementById('load-story-modal');
    const openBtn = document.getElementById('load-story-btn');
    const closeBtn = document.getElementById('close-load-modal-btn');
    const listContainer = document.getElementById('story-list-container');
    const ctxMenu = document.getElementById('story-context-menu');
    let ctxStoryId = null;

    // Context Menu Logic
    const handleGlobalClick = () => {
        if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
            ctxMenu.classList.add('hidden');
        }
    };
    document.addEventListener('click', handleGlobalClick);

    const bindContextMenuActions = () => {
        const btnClone = document.getElementById('ctx-story-clone');
        const btnDelete = document.getElementById('ctx-story-delete');

        if (btnClone) {
            // Use cloneNode to clear previous listeners if called multiple times, though execute once here is fine
            // Simple onclick assignment is safer if running once.
            btnClone.onclick = (e) => {
                e.stopPropagation();
                ctxMenu.classList.add('hidden');
                if (ctxStoryId) {
                    storage.cloneStory(ctxStoryId);
                    renderStoryList();
                }
            };
        }

        if (btnDelete) {
            btnDelete.onclick = (e) => {
                e.stopPropagation();
                ctxMenu.classList.add('hidden');
                if (ctxStoryId) {
                    if (confirm("Are you sure you want to delete this story? This cannot be undone.")) {
                        const wasActive = storage.getActiveStory()?.id === ctxStoryId;
                        storage.deleteStory(ctxStoryId);
                        renderStoryList();

                        if (wasActive) {
                            // If deleted the currently active story, we might want to reset the view
                            // effectively clearing the timeline or loading a default.
                            // For now, we'll let the user choose another story.
                            // But we should probably signal the main app that the data is gone?
                            // Refreshing with empty or default data might be safer.
                            // We can create a default empty story?
                            // const newStory = storage.createStory("New Story", []);
                            // window.timelineData = newStory.data;
                            // refreshCallback({ resetView: true });
                            // The user is in the load dialog, so they will likely pick another one.
                        }
                    }
                }
            };
        }
    };
    bindContextMenuActions();

    const openModal = () => {
        modal.classList.remove('hidden');
        renderStoryList();
    };

    const closeModal = () => modal.classList.add('hidden');

    const renderStoryList = () => {
        const stories = storage.getStories();
        stories.sort((a, b) => b.lastModified - a.lastModified);

        if (stories.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No saved stories found. Create one!</div>';
            return;
        }

        const activeStory = storage.getActiveStory();
        const activeId = activeStory ? activeStory.id : null;

        listContainer.innerHTML = stories.map(s => {
            const dateStr = new Date(s.lastModified).toLocaleString();
            const activeClass = (s.id === activeId) ? 'active-story-item' : '';
            return `
                <li class="story-item ${activeClass}" data-id="${s.id}">
                    <div class="story-info">
                        <div class="story-title">${s.name}</div>
                        <div class="story-desc">${s.description || 'No description'}</div>
                        <div class="story-meta">Last modified: ${dateStr} &middot; ${s.eventCount} events</div>
                    </div>
                    <button class="btn btn-sm btn-primary load-btn" data-id="${s.id}">Load</button>
                    ${s.id === activeId ? '<span class="badge">Active</span>' : ''}
                </li>
            `;
        }).join('');

        // Bind Events
        listContainer.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadStory(e.target.dataset.id);
            });
        });

        listContainer.querySelectorAll('.story-item').forEach(item => {
            // Load on click
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                loadStory(item.dataset.id);
            });

            // Context Menu on Right Click
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                ctxStoryId = item.dataset.id;

                // Position menu
                ctxMenu.style.left = `${e.pageX}px`;
                ctxMenu.style.top = `${e.pageY}px`;
                ctxMenu.classList.remove('hidden');
            });
        });
    };

    const loadStory = (id) => {
        const story = storage.setActiveStory(id);
        if (story) {
            window.timelineData = story.data;
            refreshCallback({ resetView: true });
            closeModal();
        }
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

function initImportExportUI(storage, refreshCallback) {
    // Download
    document.getElementById('download-sample').addEventListener('click', () => {
        const activeStory = storage.getActiveStory();
        if (activeStory) {
            const jsonContent = JSON.stringify(activeStory, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (activeStory.name || 'story').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `${safeName}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            alert("No active story to download.");
        }
    });

    // CSV Upload
    const uploadInput = document.getElementById('csv-upload');
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = d3.csvParse(event.target.result);
                    const activeStory = storage.getActiveStory();

                    if (confirm(`Importing CSV. Merge ${data.length} events into the current story "${activeStory ? activeStory.name : 'New Story'}"?`)) {
                        let mergedData = data;
                        if (activeStory && Array.isArray(activeStory.data)) {
                            ensureDataIds(data);
                            mergedData = [...activeStory.data, ...data];
                            storage.saveActiveStory(mergedData);
                        } else {
                            const name = `Imported Story ${new Date().toLocaleTimeString()}`;
                            ensureDataIds(data);
                            storage.createStory(name, data);
                        }

                        window.timelineData = mergedData;
                        refreshCallback({ resetView: true });
                    }
                } catch (error) {
                    console.error("Error parsing CSV:", error);
                    alert("Failed to parse CSV.");
                }
            };
            reader.readAsText(file);
        }
    });

    // JSON Upload
    const uploadJsonInput = document.getElementById('json-upload');
    uploadJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const story = JSON.parse(event.target.result);
                    if (story && Array.isArray(story.data)) {
                        if (confirm(`Replace active story with "${story.name || 'Uploaded Story'}"?`)) {
                            ensureDataIds(story.data);
                            storage.importStory(story);
                            window.timelineData = story.data;
                            console.log("Story imported:", story.name);
                            refreshCallback({ resetView: true });
                        }
                    } else {
                        alert("Invalid Story JSON format.");
                    }
                } catch (err) {
                    console.error("Error parsing JSON:", err);
                    alert("Failed to parse JSON file.");
                }
            };
            reader.readAsText(file);
        }
        e.target.value = '';
    });
}
