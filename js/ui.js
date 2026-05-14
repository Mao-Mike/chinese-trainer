export function initTabs(onStudyTabActivate) {
	const tabButtons = document.querySelectorAll('.tab-btn');
	const tabSections = document.querySelectorAll('.tab-section');
	const settingsToggle = document.getElementById('settings-toggle');

	function activateTab(tabId) {
		tabButtons.forEach(button => button.classList.toggle('active', button.dataset.tab === tabId));
		tabSections.forEach(section => section.classList.toggle('active', section.id === tabId));

		if (settingsToggle) {
			settingsToggle.classList.toggle('active', tabId === 'settings');
			settingsToggle.setAttribute('aria-pressed', tabId === 'settings' ? 'true' : 'false');
		}

		if (tabId === 'study' && typeof onStudyTabActivate === 'function') {
			onStudyTabActivate();
		}
	}

	tabButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			activateTab(btn.dataset.tab);
		});
	});

	if (settingsToggle) {
		settingsToggle.addEventListener('click', () => {
			activateTab('settings');
		});
	}

	return {
		activateTab
	};
}
