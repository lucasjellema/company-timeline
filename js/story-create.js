import { TimelineStorage } from './storage.js';
import { CONFIG } from './config.js';
import { ensureDataIds, parseAndPrepareCSV, generateTypeMappings } from './utils.js';

export function initCreateStoryUI(storage, refreshCallback) {
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

        const csvPaste = document.getElementById('story-csv-paste').value;
        let initialData = [];

        if (csvPaste && csvPaste.trim()) {
            try {
                initialData = parseAndPrepareCSV(csvPaste);
                console.log(`Parsed ${initialData.length} events from pasted CSV`);
            } catch (err) {
                alert(err.message);
                return; // Stop creation if CSV is invalid
            }
        }

        const mappings = generateTypeMappings(initialData, CONFIG.TYPE_COLORS, {});

        storage.createStory(title, initialData, {
            description: desc,
            start,
            end,
            settings: { colors: mappings.colors, icons: mappings.icons }
        });
        window.timelineData = initialData;

        refreshCallback({ resetView: true });
        closeModal();
    });
}
