// === MODALE APP ===
let modalResolve = null;
let modalReject = null;
let lastActiveElement = null;

function getModalElements() {
	const modal = document.getElementById('app-modal');
	return {
		modal,
		title: document.getElementById('app-modal-title'),
		message: document.getElementById('app-modal-message'),
		cancel: document.getElementById('app-modal-cancel'),
		confirm: document.getElementById('app-modal-confirm'),
		actions: modal ? modal.querySelector('.modal-actions') : null
	};
}

function closeModal(result) {
	const { modal } = getModalElements();
	modal.style.display = 'none';
	modal.setAttribute('aria-hidden', 'true');
	if (lastActiveElement) {
		lastActiveElement.focus();
		lastActiveElement = null;
	}
	if (modalResolve) {
		modalResolve(result);
		modalResolve = null;
		modalReject = null;
	}
}

function handleModalKey(e) {
	if (e.key === 'Escape') {
		e.preventDefault();
		closeModal(false);
	} else if (e.key === 'Tab') {
		// Focus trap
		const { cancel, confirm } = getModalElements();
		const focusables = [cancel, confirm].filter(Boolean);
		if (focusables.length < 1) return;
		const idx = focusables.indexOf(document.activeElement);
		if (e.shiftKey) {
			if (idx <= 0) {
				focusables[focusables.length - 1].focus();
				e.preventDefault();
			}
		} else {
			if (idx === focusables.length - 1) {
				focusables[0].focus();
				e.preventDefault();
			}
		}
	}
}

export function showAlert(message, title = 'Avviso') {
	return new Promise(resolve => {
		const { modal, title: t, message: m, cancel, confirm } = getModalElements();
		lastActiveElement = document.activeElement;
		t.textContent = title;
		m.textContent = message;
		cancel.style.display = 'none';
		confirm.textContent = 'OK';
		confirm.classList.add('btn-primary');
		confirm.classList.remove('btn-secondary');
		modal.style.display = 'flex';
		modal.setAttribute('aria-hidden', 'false');
		setTimeout(() => { confirm.focus(); }, 10);
		modalResolve = () => resolve();
		modalReject = null;
		function onConfirm() { closeModal(); }
		confirm.onclick = onConfirm;
		cancel.onclick = null;
		document.addEventListener('keydown', handleModalKey, { once: true });
	});
}

export function showConfirm(message, title = 'Conferma') {
	return new Promise(resolve => {
		const { modal, title: t, message: m, cancel, confirm } = getModalElements();
		lastActiveElement = document.activeElement;
		t.textContent = title;
		m.textContent = message;
		cancel.style.display = '';
		cancel.textContent = 'Annulla';
		confirm.textContent = 'Conferma';
		confirm.classList.add('btn-primary');
		confirm.classList.remove('btn-secondary');
		modal.style.display = 'flex';
		modal.setAttribute('aria-hidden', 'false');
		setTimeout(() => { confirm.focus(); }, 10);
		modalResolve = (result) => resolve(result);
		modalReject = null;
		function onCancel() { closeModal(false); }
		function onConfirm() { closeModal(true); }
		cancel.onclick = onCancel;
		confirm.onclick = onConfirm;
		document.addEventListener('keydown', handleModalKey, { once: true });
	});
}
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
