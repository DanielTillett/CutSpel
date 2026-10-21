/*
    Copyright (c) 2016 Junling Guo & Daniel Tillett

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
*/

(function() {
	// Elements whose text should never be changed
	var SKIP_TAGS = {SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, TEMPLATE: 1, SVG: 1};

	//Keep capitalization of words.
	function matchCase(found, cut) {
		if (found.length > 1 && found === found.toUpperCase() && found !== found.toLowerCase()) {
			return cut.toUpperCase();
		}
		return /[A-Z]/.test(found.charAt(0)) ? (cut.charAt(0).toUpperCase() + cut.substring(1)) : cut.toLowerCase();
	}

	function escapeRegex(word) {
		return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	function shouldSkip(node) {
		for (var el = node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
			if (SKIP_TAGS[el.nodeName.toUpperCase()] || el.isContentEditable) {
				return true;
			}
		}
		return false;
	}

	function buildCutter(words, advanced) {
		var cuts = {},
			patterns = [];

		for (var i = 0; i < words.length; i++) {
			if (advanced || words[i][2]) {
				cuts[words[i][0]] = words[i][1];
				//Match both straight and curly apostrophes
				patterns.push(escapeRegex(words[i][0]).replace(/'/g, "['’]"));
			}
		}
		if (patterns.length === 0) {
			return null;
		}
		//Longest first so the alternation prefers whole words
		patterns.sort(function(a, b) { return b.length - a.length; });
		var regex = new RegExp("\\b(?:" + patterns.join("|") + ")\\b", "gi");

		return function(text) {
			return text.replace(regex, function(found) {
				var cut = cuts[found.toLowerCase().replace(/’/g, "'")];
				return cut === undefined ? found : matchCase(found, cut);
			});
		};
	}

	function CutSpel(cutter) {
		var originals = new Map(),	// text node -> {orig, cut}
			observer = null,
			self = this;

		function replaceText(node) {
			var val = node.nodeValue;
			if (!val || val.length < 2 || shouldSkip(node)) {
				return;
			}
			var newVal = cutter(val);
			if (newVal !== val) {
				var saved = originals.get(node);
				originals.set(node, {orig: saved && saved.cut === val ? saved.orig : val, cut: newVal});
				node.nodeValue = newVal;
			}
		}

		function walk(root) {
			if (root.nodeType === 3) {
				replaceText(root);
				return;
			}
			if (root.nodeType !== 1 || SKIP_TAGS[root.nodeName.toUpperCase()]) {
				return;
			}
			var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
				node;
			while ((node = walker.nextNode())) {
				replaceText(node);
			}
		}

		function report() {
			chrome.runtime.sendMessage({action: "cutspel_state", cut: self.cut}).catch(function() {});
		}

		this.cut = false;

		this.cutPage = function() {
			walk(document.body);

			//Cut text that pages add after loading
			var pending = [],
				scheduled = false;
			observer = new MutationObserver(function(mutations) {
				for (var m = 0; m < mutations.length; m++) {
					var added = mutations[m].addedNodes;
					for (var n = 0; n < added.length; n++) {
						pending.push(added[n]);
					}
				}
				if (!scheduled && pending.length) {
					scheduled = true;
					setTimeout(function() {
						var nodes = pending;
						pending = [];
						scheduled = false;
						if (!observer) {
							return;
						}
						for (var k = 0; k < nodes.length; k++) {
							if (nodes[k].isConnected) {
								walk(nodes[k]);
							}
						}
					}, 100);
				}
			});
			observer.observe(document.body, {childList: true, subtree: true});
			this.cut = true;
			report();
		};

		//Put back the traditional spelling, leaving any text the page has since changed
		this.restorePage = function() {
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			originals.forEach(function(saved, node) {
				if (node.nodeValue === saved.cut) {
					node.nodeValue = saved.orig;
				}
			});
			originals.clear();
			this.cut = false;
			report();
		};

		this.toggle = function() {
			if (this.cut) {
				this.restorePage();
			} else {
				this.cutPage();
			}
		};
	}

	if (!document.body) {
		return;
	}
	//Injected again by a toolbar click: switch this page between cut and traditional
	if (window.__cutspel) {
		if (window.__cutspel !== "loading") {
			window.__cutspel.toggle();
		}
		return;
	}
	window.__cutspel = "loading";
	chrome.storage.local.get(["cutspel_basic", "cutspel_words"], function(settings) {
		var cutter = settings.cutspel_words && buildCutter(settings.cutspel_words, settings.cutspel_basic === "-1");
		if (!cutter) {
			window.__cutspel = null;
			return;
		}
		window.__cutspel = new CutSpel(cutter);
		window.__cutspel.cutPage();
	});
})();
