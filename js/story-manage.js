import { TimelineStorage } from './storage.js';

export function initLoadStoryUI(storage, refreshCallback) {
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
