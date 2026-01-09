
export class TimelineContextMenu {
    constructor(storage, onUpdate) {
        this.storage = storage;
        this.onUpdate = onUpdate;
        this.ctxMenu = document.getElementById('context-menu');
        this.ctxMenuContext = null;
        this.init();
    }

    init() {
        if (!this.ctxMenu) return;

        // Global click to hide menu
        document.addEventListener('click', () => {
            if (!this.ctxMenu.classList.contains('hidden')) {
                this.ctxMenu.classList.add('hidden');
            }
        });

        this.bindMenuAction('ctx-move-up', ({ currentOrder, idx, activeStory }) => {
            if (idx <= 0) return;
            const newOrder = [...currentOrder];
            [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
            this.storage.updateStorySettings(activeStory.id, {}, { groupOrder: newOrder });
            this.onUpdate();
        });

        this.bindMenuAction('ctx-move-down', ({ currentOrder, idx, activeStory }) => {
            if (idx >= currentOrder.length - 1) return;
            const newOrder = [...currentOrder];
            [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
            this.storage.updateStorySettings(activeStory.id, {}, { groupOrder: newOrder });
            this.onUpdate();
        });

        this.bindMenuAction('ctx-expand', ({ category, activeStory }) => {
            let collapsedGroups = (activeStory.settings && activeStory.settings.collapsedGroups) ? [...activeStory.settings.collapsedGroups] : [];
            const idx = collapsedGroups.indexOf(category);
            if (idx > -1) {
                collapsedGroups.splice(idx, 1);
                this.storage.updateStorySettings(activeStory.id, {}, { collapsedGroups });
                this.onUpdate();
            }
        });

        this.bindMenuAction('ctx-collapse', ({ category, activeStory }) => {
            let collapsedGroups = (activeStory.settings && activeStory.settings.collapsedGroups) ? [...activeStory.settings.collapsedGroups] : [];
            if (!collapsedGroups.includes(category)) {
                collapsedGroups.push(category);
                this.storage.updateStorySettings(activeStory.id, {}, { collapsedGroups });
                this.onUpdate();
            }
        });
    }

    show(e, category, currentOrder) {
        const activeStory = this.storage.getActiveStory();
        if (!activeStory) return;

        this.ctxMenu.classList.remove('hidden');
        this.ctxMenu.style.left = `${e.pageX}px`;
        this.ctxMenu.style.top = `${e.pageY}px`;

        // Determine state
        let collapsedGroups = (activeStory.settings && activeStory.settings.collapsedGroups) ? [...activeStory.settings.collapsedGroups] : [];
        const isCollapsed = collapsedGroups.includes(category);

        const idx = currentOrder.indexOf(category);
        const canMoveUp = idx > 0;
        const canMoveDown = idx < currentOrder.length - 1;

        // Show/Hide Items
        const btnUp = document.getElementById('ctx-move-up');
        const btnDown = document.getElementById('ctx-move-down');
        const btnExpand = document.getElementById('ctx-expand');
        const btnCollapse = document.getElementById('ctx-collapse');
        const btnEdit = document.getElementById('ctx-edit');
        const btnDelete = document.getElementById('ctx-delete');

        if (btnUp) btnUp.style.display = canMoveUp ? 'flex' : 'none';
        if (btnDown) btnDown.style.display = canMoveDown ? 'flex' : 'none';
        if (btnExpand) btnExpand.style.display = isCollapsed ? 'flex' : 'none';
        if (btnCollapse) btnCollapse.style.display = !isCollapsed ? 'flex' : 'none';

        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        const btnBExpandL1 = document.getElementById('ctx-expand-l1');
        const btnBCollapseL1 = document.getElementById('ctx-collapse-l1');
        if (btnBExpandL1) btnBExpandL1.style.display = 'none';
        if (btnBCollapseL1) btnBCollapseL1.style.display = 'none';

        this.ctxMenuContext = { category, idx, currentOrder, activeStory };
    }

    bindMenuAction(id, callback) {
        const el = document.getElementById(id);
        if (!el) return;
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ctxMenu.classList.add('hidden');
            if (this.ctxMenuContext) callback(this.ctxMenuContext);
        });
    }
}
