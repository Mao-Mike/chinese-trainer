// js/settings.js
export function initSettings() {
	const apiKeyInput = document.getElementById('gemini-api-key');
	const modelInput = document.getElementById('gemini-model');
	const saveBtn = document.getElementById('settings-save');
	const deleteBtn = document.getElementById('settings-delete-key');
	const testBtn = document.getElementById('settings-test');
	const statusDiv = document.getElementById('settings-status');

	// Carica valori da localStorage
	const savedKey = localStorage.getItem('geminiApiKey');
	const savedModel = localStorage.getItem('geminiModel') || 'gemini-2.5-flash';
	modelInput.value = savedModel;
	apiKeyInput.value = '';
	if (savedKey) {
		statusDiv.textContent = 'API key salvata';
	} else {
		statusDiv.textContent = 'Nessuna API key salvata';
	}

	saveBtn.onclick = () => {
		const key = apiKeyInput.value.trim();
		const model = modelInput.value.trim() || 'gemini-2.5-flash';
		if (key) {
			localStorage.setItem('geminiApiKey', key);
			statusDiv.textContent = 'API key salvata';
			apiKeyInput.value = '';
		} else {
			statusDiv.textContent = 'Inserisci una API key valida';
			return;
		}
		localStorage.setItem('geminiModel', model);
	};

	deleteBtn.onclick = () => {
		localStorage.removeItem('geminiApiKey');
		statusDiv.textContent = 'API key eliminata';
	};

	testBtn.onclick = async () => {
		statusDiv.textContent = 'Test in corso...';
		try {
			const result = await enrichWordWithAI('好');
			statusDiv.textContent = 'Risposta: ' + (result ? 'OK' : 'Nessuna risposta');
		} catch (e) {
			statusDiv.textContent = 'Errore: ' + (e && e.message ? e.message : e);
		}
	};
}

// enrichWordWithAI deve essere definita globalmente o importata altrove
