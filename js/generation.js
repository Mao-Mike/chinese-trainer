import { getAllWords, saveLastGenerated } from './storage.js';
import { pick, randomInt, shuffle } from './utils.js';

function randomTitle(type, topic) {
	if (topic && topic.trim()) {
		return type === 'dialogue' ? `Dialogo su "${topic.trim()}"` : `Testo su "${topic.trim()}"`;
	}

	const textTitles = [
		'Una giornata a scuola',
		'Il mio animale preferito',
		'Viaggio in città',
		'Cosa mangio a colazione',
		'Un sogno divertente',
		'La mia famiglia',
		'Un giorno di pioggia',
		'Al mercato',
		'La mia routine',
		'Un ricordo speciale'
	];

	const dialogueTitles = [
		'Conversazione al ristorante',
		'Due amici si incontrano',
		'Comprare un biglietto',
		'Dialogo in classe',
		'Chiedere indicazioni',
		'Al telefono',
		'In biblioteca',
		'Al parco',
		'In viaggio',
		'Alla stazione'
	];

	return type === 'dialogue' ? pick(dialogueTitles) : pick(textTitles);
}

function generateDemoText(words, length) {
	const pool = words.length ? shuffle(words) : [
		{ hanzi: '我', pinyin: 'wǒ', translation: 'io' },
		{ hanzi: '喜欢', pinyin: 'xǐ huān', translation: 'piace' },
		{ hanzi: '学习', pinyin: 'xué xí', translation: 'studiare' },
		{ hanzi: '中文', pinyin: 'zhōng wén', translation: 'cinese' },
		{ hanzi: '朋友', pinyin: 'péng you', translation: 'amico' },
		{ hanzi: '吃饭', pinyin: 'chī fàn', translation: 'mangiare' },
		{ hanzi: '学校', pinyin: 'xué xiào', translation: 'scuola' },
		{ hanzi: '老师', pinyin: 'lǎo shī', translation: 'insegnante' }
	];

	let out = '';
	while (out.length < length) {
		out += pick(pool).hanzi;
		if (Math.random() > 0.7) out += '，';
	}
	return out.slice(0, length) + '。';
}

function generateDemoDialogue(words, length) {
	const pool = words.length ? shuffle(words) : [
		{ hanzi: '你', pinyin: 'nǐ', translation: 'tu' },
		{ hanzi: '好吗', pinyin: 'hǎo ma', translation: 'come va' },
		{ hanzi: '谢谢', pinyin: 'xiè xie', translation: 'grazie' },
		{ hanzi: '再见', pinyin: 'zài jiàn', translation: 'arrivederci' },
		{ hanzi: '今天', pinyin: 'jīn tiān', translation: 'oggi' },
		{ hanzi: '天气', pinyin: 'tiān qì', translation: 'tempo (meteo)' },
		{ hanzi: '很好', pinyin: 'hěn hǎo', translation: 'molto bene' },
		{ hanzi: '请问', pinyin: 'qǐng wèn', translation: 'scusi' }
	];

	const nSpeakers = randomInt(2, 4);
	const names = ['A', 'B', 'C', 'D'].slice(0, nSpeakers);
	const lines = [];
	let total = 0;

	while (total < length) {
		const name = pick(names);
		let phrase = '';
		for (let i = 0; i < randomInt(2, 7); i++) {
			phrase += pick(pool).hanzi;
		}
		lines.push(name + ': ' + phrase);
		total += phrase.length;
	}

	return lines.join('\n');
}

export function initGeneration(renderStudy) {
	const genTypeRadios = document.getElementsByName('gen-type');
	const genLength = document.getElementById('gen-length');
	const genLengthValue = document.getElementById('gen-length-value');
	const genBtn = document.getElementById('gen-generate');
	const genTitle = document.getElementById('gen-title');
	const genTopicInput = document.getElementById('gen-topic');

	genLengthValue.textContent = genLength.value;
	genLength.oninput = () => {
		genLengthValue.textContent = genLength.value;
	};

	genBtn.onclick = async () => {
		const type = Array.from(genTypeRadios).find(radio => radio.checked).value;
		const length = parseInt(genLength.value, 10);
		const topic = genTopicInput.value.trim();
		const words = await getAllWords();

		if (!words.length && type === 'text') {
			genTitle.textContent = 'Aggiungi parole nel dizionario!';
			saveLastGenerated(null);
			renderStudy();
			return;
		}

		const title = randomTitle(type, topic);
		const content = type === 'text' ? generateDemoText(words, length) : generateDemoDialogue(words, length);

		saveLastGenerated({
			type,
			title,
			content,
			topic: topic || '',
			words: words.length ? words : null
		});

		genTitle.textContent = title;
		renderStudy();
	};
}
