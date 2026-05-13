export function randomInt(a, b) {
	return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function shuffle(arr) {
	const copy = arr.slice();
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export function pick(arr) {
	return arr[randomInt(0, arr.length - 1)];
}

export function fakePinyin(word) {
	return word.split('').map(() => 'pīn').join(' ');
}

export function fakeTranslation(word) {
	return 'Traduzione di ' + word;
}
