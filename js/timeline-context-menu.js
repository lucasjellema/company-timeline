
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

        this.bindMenuAction('ctx-expand-all', ({ activeStory }) => {
            // Expand All: Clear both collapsedGroups and collapsedLevel1s
            this.storage.updateStorySettings(activeStory.id, {}, { collapsedGroups: [], collapsedLevel1s: [] });
            this.onUpdate();
        });

        this.bindMenuAction('ctx-collapse-all', ({ activeStory, allData }) => {
            // Collapse All: Add all Level 0 and Level 1 keys to collapsed lists
            const data = allData || window.timelineData || [];
            if (!data.length) return;

            const allLevel0 = new Set();
            const allLevel1 = new Set();

            data.forEach(d => {
                if (d.level0) allLevel0.add(d.level0);
                if (d.level0 && d.level1) {
                    const l0 = (d.level0 || "").trim();
                    const l1 = (d.level1 || "").trim();
                    allLevel1.add(`${l0}|${l1}`);
                }
            });

            this.storage.updateStorySettings(activeStory.id, {}, {
                collapsedGroups: Array.from(allLevel0),
                collapsedLevel1s: Array.from(allLevel1)
            });
            this.onUpdate();
        });
    }

    show(e, category, currentOrder, allData = null) {
        const activeStory = this.storage.getActiveStory();
        if (!activeStory) return;

        this.ctxMenu.classList.remove('hidden');

        // Prevent menu from going off-screen
        const menuWidth = 180; // aprox width
        const menuHeight = 250; // aprox height

        let left = e.pageX;
        let top = e.pageY;

        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
        if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;

        this.ctxMenu.style.left = `${left}px`;
        this.ctxMenu.style.top = `${top}px`;

        // Determine state
        let collapsedGroups = (activeStory.settings && activeStory.settings.collapsedGroups) ? [...activeStory.settings.collapsedGroups] : [];
        const isCollapsed = category && collapsedGroups.includes(category);

        const idx = currentOrder ? currentOrder.indexOf(category) : -1;
        const canMoveUp = idx > 0;
        const canMoveDown = idx > -1 && idx < currentOrder.length - 1;

        // Show/Hide Items
        const btnUp = document.getElementById('ctx-move-up');
        const btnDown = document.getElementById('ctx-move-down');
        const btnExpand = document.getElementById('ctx-expand');
        const btnCollapse = document.getElementById('ctx-collapse');
        const btnExpandAll = document.getElementById('ctx-expand-all');
        const btnCollapseAll = document.getElementById('ctx-collapse-all');
        const btnEdit = document.getElementById('ctx-edit');
        const btnDelete = document.getElementById('ctx-delete');

        // Logic:
        // If category is provided -> Show Item Specific actions (Move, Expand/Collapse This, etc)
        // If category is NULL -> Show Global actions (Expand All, Collapse All) only? 
        // OR user wants Expand/Collapse All visible ALWAYS? The request says "context menu for the border", which implies a separate menu or context.
        // Assuming "border" click triggers global context, and existing category click triggers category context.

        if (category) {
            if (btnUp) btnUp.style.display = canMoveUp ? 'flex' : 'none';
            if (btnDown) btnDown.style.display = canMoveDown ? 'flex' : 'none';
            if (btnExpand) btnExpand.style.display = isCollapsed ? 'flex' : 'none';
            if (btnCollapse) btnCollapse.style.display = !isCollapsed ? 'flex' : 'none';

            if (btnExpandAll) btnExpandAll.style.display = 'none';
            if (btnCollapseAll) btnCollapseAll.style.display = 'none';
        } else {
            // Global Context (Border Click)
            if (btnUp) btnUp.style.display = 'none';
            if (btnDown) btnDown.style.display = 'none';
            if (btnExpand) btnExpand.style.display = 'none';
            if (btnCollapse) btnCollapse.style.display = 'none'; // Can't collapse specific if none selected

            if (btnExpandAll) btnExpandAll.style.display = 'flex';
            if (btnCollapseAll) btnCollapseAll.style.display = 'flex';
        }

        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        const btnBExpandL1 = document.getElementById('ctx-expand-l1');
        const btnBCollapseL1 = document.getElementById('ctx-collapse-l1');
        if (btnBExpandL1) btnBExpandL1.style.display = 'none';
        if (btnBCollapseL1) btnBCollapseL1.style.display = 'none';

        this.ctxMenuContext = { category, idx, currentOrder, activeStory, allData };
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
