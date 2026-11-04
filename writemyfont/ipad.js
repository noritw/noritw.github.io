// iPad 擴充：雙指縮放書寫格、參考字型底字、即時排版預覽
// 需在 fontdrawer.js 之前載入；執行時才使用 fontdrawer.js 的 glyphMap、settings、loadFromDB。
const wmfIpad = (function () {
	const MIN_BOX = 200;
	const REF_DB = 'WmfIpadDB';		// 參考字型另存一個資料庫，不會混進字型備份檔
	const REF_FAMILY = 'WmfImportedRef';
	const SYSTEM_FONTS = {
		'pingfang': '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
		'songti': '"Songti TC", "Noto Serif TC", PMingLiU, serif',
		'kaiti': '"Kaiti TC", "BiauKai", DFKai-SB, serif'
	};

	function loadPref(key, value) {
		try {
			const saved = localStorage.getItem('wmf_' + key);
			return saved === null ? value : JSON.parse(saved);
		} catch (e) {
			return value;
		}
	}
	function savePref(key, value) {
		prefs[key] = value;
		try { localStorage.setItem('wmf_' + key, JSON.stringify(value)); } catch (e) {}
	}

	const prefs = {
		box: loadPref('box', 0),
		penOnly: loadPref('penOnly', false),
		trueBaseline: loadPref('trueBaseline', true),
		refSource: loadPref('refSource', 'pingfang'),
		refOpacity: loadPref('refOpacity', 30),
		previewText: loadPref('previewText', '海苔的手寫字型 Hello 123'),
		previewSize: loadPref('previewSize', 36)
	};

	let currentChar = '';
	let importedReady = false;

	// ---------- 書寫格大小 ----------
	function maxBox() {
		const w = window.innerWidth, h = window.innerHeight;
		if (w >= 900 && w > h) return Math.max(MIN_BOX, Math.min(h - 150, w - Math.min(420, Math.max(320, w * 0.34)) - 60));
		if (w >= 700) return Math.max(MIN_BOX, Math.min(w - 40, h - 480));
		return Math.max(MIN_BOX, Math.min(w - 20, h - 340));
	}
	function setBox(size, save) {
		const box = Math.round(Math.min(maxBox(), Math.max(MIN_BOX, size)));
		document.documentElement.style.setProperty('--box', box + 'px');
		const slider = document.getElementById('wmfBoxSlider');
		if (slider) {
			slider.max = maxBox();
			slider.value = box;
			document.getElementById('wmfBoxValue').textContent = box + 'px';
		}
		if (save) savePref('box', box);
		return box;
	}
	function currentBox() {
		return document.getElementById('canvas-container').clientWidth;
	}

	// ---------- 雙指縮放 ----------
	const pinch = { active: false, startDist: 0, startBox: 0, moved: false };
	function touchDist(e) {
		return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
	}
	function inPinchArea(target) {
		return target.closest && !target.closest('.dialog, #wmf-preview, #list-container');
	}
	function initPinch() {
		document.addEventListener('touchstart', function (e) {
			if (e.touches.length === 2 && inPinchArea(e.target)) {
				pinch.active = true;
				pinch.moved = false;
				pinch.startDist = touchDist(e);
				pinch.startBox = currentBox();
			}
		}, { capture: true, passive: true });

		document.addEventListener('touchmove', function (e) {
			if (!pinch.active || e.touches.length < 2) return;
			e.preventDefault();
			const dist = touchDist(e);
			if (Math.abs(dist - pinch.startDist) > 12) pinch.moved = true;
			if (pinch.moved) setBox(pinch.startBox * dist / pinch.startDist, false);
		}, { capture: true, passive: false });

		document.addEventListener('touchend', function (e) {
			if (!pinch.active || e.touches.length > 0) return;
			pinch.active = false;
			if (pinch.moved) setBox(currentBox(), true);
		}, { capture: true, passive: true });

		// 避免 Safari 把雙指手勢當成整頁放大
		['gesturestart', 'gesturechange'].forEach(function (name) {
			document.addEventListener(name, function (e) { e.preventDefault(); }, { passive: false });
		});
	}

	// 回傳 true 時，這個事件不算開始畫線
	function ignoreStroke(event) {
		if (pinch.active) return true;
		if (!prefs.penOnly) return false;
		const oe = event.originalEvent || event;
		if (oe.pointerType) return oe.pointerType === 'touch';
		if (oe.touches && oe.touches.length) return oe.touches[0].touchType !== 'stylus';
		return false;
	}

	// ---------- 參考字型 ----------
	function openRefDB() {
		return new Promise(function (resolve, reject) {
			const req = indexedDB.open(REF_DB, 1);
			req.onupgradeneeded = function () { req.result.createObjectStore('files'); };
			req.onsuccess = function () { resolve(req.result); };
			req.onerror = function () { reject(req.error); };
		});
	}
	async function storeRefFile(name, buffer) {
		const refDB = await openRefDB();
		return new Promise(function (resolve, reject) {
			const tx = refDB.transaction('files', 'readwrite');
			tx.objectStore('files').put({ name: name, buffer: buffer }, 'ref');
			tx.oncomplete = resolve;
			tx.onerror = function () { reject(tx.error); };
		});
	}
	async function readRefFile() {
		const refDB = await openRefDB();
		return new Promise(function (resolve, reject) {
			const req = refDB.transaction('files').objectStore('files').get('ref');
			req.onsuccess = function () { resolve(req.result); };
			req.onerror = function () { reject(req.error); };
		});
	}
	async function activateRefFont(buffer) {
		const face = new FontFace(REF_FAMILY, buffer);
		await face.load();
		document.fonts.add(face);
		importedReady = true;
	}
	function refFontFamily() {
		if (prefs.refSource === 'imported') return importedReady ? '"' + REF_FAMILY + '", sans-serif' : null;
		return SYSTEM_FONTS[prefs.refSource] || null;
	}
	function drawReference() {
		const canvas = document.getElementById('refCanvas');
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		canvas.style.opacity = prefs.refOpacity / 100;
		const family = refFontFamily();
		if (!family || !currentChar) return;

		// 用字身框和真實基線定位，畫出來的位置就是這個字在字型裡的位置
		const scale = (typeof settings !== 'undefined' && settings ? settings.scaleRate : 100) / 100;
		const em = canvas.height / scale;
		const top = (canvas.height - em) / 2;
		ctx.font = em + 'px ' + family;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#2274a5';
		ctx.fillText(currentChar, canvas.width / 2, top + em * 0.88);
	}

	// ---------- 即時排版預覽 ----------
	const svgCache = {};
	let charToGlyph = null;
	let renderSerial = 0;
	let renderTimer = null;

	function glyphForChar(char) {
		if (!charToGlyph) {
			charToGlyph = {};
			for (const name in glyphMap) {
				const c = glyphMap[name].c;
				if (name.indexOf('.vert') < 0 && !(c in charToGlyph)) charToGlyph[c] = name;
			}
		}
		return charToGlyph[char];
	}
	async function glyphSVG(name) {
		if (!(name in svgCache)) svgCache[name] = await loadFromDB('s_' + name);
		return svgCache[name];
	}
	function makeGlyph(name, svgData, size, measure) {
		const ns = 'http://www.w3.org/2000/svg';
		const scale = settings.scaleRate / 100;
		const off = (1000 - scale * 1000) / 2;
		const path = document.createElementNS(ns, 'path');
		path.setAttribute('d', svgData);
		path.setAttribute('fill-rule', 'evenodd');
		path.setAttribute('transform', 'translate(' + off + ' ' + off + ') scale(' + scale + ')');

		measure.appendChild(path);
		const box = path.getBBox();
		measure.removeChild(path);

		// 字寬規則和 fontdrawer.js 匯出時相同
		const width = glyphMap[name].w;
		let pad = 0;
		if (width === 'P' || width === 'H') pad = 50;
		else if (settings.noFixedWidthFlag) pad = 100;
		const x = pad ? box.x * scale + off - pad : 0;
		const advance = pad ? box.width * scale + pad * 2 : 1000;

		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('viewBox', x + ' 0 ' + advance + ' 1000');
		svg.setAttribute('width', advance / 1000 * size);
		svg.setAttribute('height', size);
		svg.appendChild(path);
		return svg;
	}
	async function renderPreview() {
		const out = document.getElementById('wmf-output');
		if (!out || typeof settings === 'undefined' || !settings) return;
		const serial = ++renderSerial;
		const size = prefs.previewSize;
		const measure = document.getElementById('wmf-measure');
		const frag = document.createDocumentFragment();
		let missing = 0;

		for (const char of prefs.previewText) {
			if (char === '\n') {
				frag.appendChild(document.createElement('br'));
				continue;
			}
			if (char === ' ' || char === '　') {
				const gap = document.createElement('span');
				gap.className = 'wmf-gap';
				gap.style.width = (char === ' ' ? size * 0.3 : size) + 'px';
				gap.style.height = size + 'px';
				frag.appendChild(gap);
				continue;
			}
			const name = glyphForChar(char);
			const svgData = name ? await glyphSVG(name) : null;
			if (serial !== renderSerial) return;		// 打字時有更新的內容，放棄這輪

			const cell = document.createElement('button');
			cell.type = 'button';
			cell.dataset.char = char;
			if (svgData) {
				cell.className = 'wmf-glyph';
				cell.appendChild(makeGlyph(name, svgData, size, measure));
			} else {
				missing++;
				cell.className = 'wmf-missing';
				cell.textContent = char;
				cell.style.fontSize = size * 0.8 + 'px';
				cell.style.width = cell.style.height = size + 'px';
			}
			frag.appendChild(cell);
		}
		out.replaceChildren(frag);
		document.getElementById('wmf-missing-count').textContent = missing ? missing + ' 字未寫，點一下可去寫' : '全部都寫好了';
	}
	function queueRender(delay) {
		clearTimeout(renderTimer);
		renderTimer = setTimeout(renderPreview, delay);
	}

	// ---------- 介面 ----------
	function bindSetting(id, event, handler) {
		document.getElementById(id).addEventListener(event, handler);
	}
	async function initUI() {
		const refSource = document.getElementById('wmfRefSource');
		const textInput = document.getElementById('wmf-text');
		const sizeInput = document.getElementById('wmf-size');

		refSource.value = prefs.refSource;
		document.getElementById('wmfRefOpacity').value = prefs.refOpacity;
		document.getElementById('wmfPenOnly').checked = prefs.penOnly;
		document.getElementById('wmfTrueBaseline').checked = prefs.trueBaseline;
		textInput.value = prefs.previewText;
		sizeInput.value = prefs.previewSize;

		bindSetting('wmfRefButton', 'click', function () { document.getElementById('wmf-ref-container').style.display = 'block'; });
		bindSetting('wmfCloseRef', 'click', function () { document.getElementById('wmf-ref-container').style.display = 'none'; });
		bindSetting('wmfRefToggle', 'click', function () {
			const canvas = document.getElementById('refCanvas');
			canvas.hidden = !canvas.hidden;
			this.classList.toggle('wmf-off', canvas.hidden);
		});
		bindSetting('wmfRefSource', 'change', function () {
			savePref('refSource', this.value);
			drawReference();
		});
		bindSetting('wmfRefOpacity', 'input', function () {
			savePref('refOpacity', this.value * 1);
			drawReference();
		});
		bindSetting('wmfBoxSlider', 'input', function () { setBox(this.value * 1, true); });
		bindSetting('wmfPenOnly', 'change', function () { savePref('penOnly', this.checked); });
		bindSetting('wmfTrueBaseline', 'change', function () {
			savePref('trueBaseline', this.checked);
			initCanvas(document.getElementById('drawingCanvas'));
		});
		bindSetting('wmfRefFile', 'change', async function () {
			const status = document.getElementById('wmfRefStatus');
			const file = this.files[0];
			if (!file) return;
			status.textContent = '讀取中…';
			try {
				const buffer = await file.arrayBuffer();
				await activateRefFont(buffer);
				await storeRefFile(file.name, buffer);
				savePref('refSource', 'imported');
				refSource.value = 'imported';
				status.textContent = '已匯入：' + file.name;
				drawReference();
			} catch (e) {
				status.textContent = '無法讀取這個檔案，請換一個 OTF、TTF 或 WOFF 字型。';
			}
		});

		bindSetting('wmf-text', 'input', function () {
			savePref('previewText', this.value);
			queueRender(120);
		});
		bindSetting('wmf-size', 'input', function () {
			savePref('previewSize', this.value * 1);
			queueRender(60);
		});
		bindSetting('wmf-output', 'click', function (e) {
			const cell = e.target.closest('[data-char]');
			if (cell && window.wmfFindChar) window.wmfFindChar(cell.dataset.char);
		});

		window.addEventListener('resize', function () { setBox(currentBox(), false); });
		setBox(prefs.box || maxBox(), false);

		try {
			const saved = await readRefFile();
			if (saved) {
				await activateRefFont(saved.buffer);
				document.getElementById('wmfRefStatus').textContent = '已匯入：' + saved.name;
				drawReference();
			}
		} catch (e) {
			console.error('參考字型載入失敗', e);
		}
	}

	document.addEventListener('DOMContentLoaded', function () {
		initPinch();
		initUI();
	});

	return {
		ignoreStroke: ignoreStroke,
		didPinch: function () { return pinch.moved; },
		baselineRatio: function () { return prefs.trueBaseline ? 0.88 : 0.75; },
		onGrid: drawReference,
		onGlyph: function (char) {
			currentChar = Array.from(char)[0] || '';
			drawReference();
			queueRender(0);
		},
		onSaved: function (glyph) {
			delete svgCache[glyph];
			queueRender(0);
		}
	};
})();
