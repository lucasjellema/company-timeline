import { TimelineStorage } from './storage.js';
import { initSettingsUI } from './story-settings.js';

export function initStoryUI(storage, refreshCallback) {
    initCreateStoryUI(storage, refreshCallback);
    initLoadStoryUI(storage, refreshCallback);
    initSettingsUI(storage, refreshCallback);
    initImportExportUI(storage, refreshCallback);
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
                </li>
            `;
        }).join('');

        listContainer.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadStory(e.target.dataset.id);
            });
        });

        listContainer.querySelectorAll('.story-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                loadStory(item.dataset.id);
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
                    if (confirm("Importing CSV. Create a new Story from this?")) {
                        const name = `Imported Story ${new Date().toLocaleTimeString()}`;
                        storage.createStory(name, data);
                        window.timelineData = data;
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
