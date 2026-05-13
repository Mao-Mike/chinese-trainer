export function initTabs(onStudyTabActivate) {
	const tabButtons = document.querySelectorAll('.tab-btn');
	const tabSections = document.querySelectorAll('.tab-section');

	tabButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			tabButtons.forEach(button => button.classList.remove('active'));
			btn.classList.add('active');

			tabSections.forEach(section => section.classList.remove('active'));
			const target = document.getElementById(btn.dataset.tab);
			if (target) {
				target.classList.add('active');
			}

			if (btn.dataset.tab === 'study' && typeof onStudyTabActivate === 'function') {
				onStudyTabActivate();
			}
		});
	});
}
