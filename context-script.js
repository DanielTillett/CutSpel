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

	function start(words, advanced) {
		var cuts = {},
			patterns = [];

		for (var i = 0; i < words.length; i++) {
			if (advanced || words[i][2]) {
				cuts[words[i][0]] = words[i][1];
				//Match both straight and curly apostrophes
				patterns.push(escapeRegex(words[i][0]).replace(/'/g, "['\u2019]"));
			}
		}
		if (patterns.length === 0) {
			return;
		}
		//Longest first so the alternation prefers whole words
		patterns.sort(function(a, b) { return b.length - a.length; });
		var regex = new RegExp("\\b(?:" + patterns.join("|") + ")\\b", "gi");

		function replaceText(node) {
			var val = node.nodeValue;
			if (!val || val.length < 2 || shouldSkip(node)) {
				return;
			}
			var newVal = val.replace(regex, function(found) {
				var cut = cuts[found.toLowerCase().replace(/\u2019/g, "'")];
				return cut === undefined ? found : matchCase(found, cut);
			});
			if (newVal !== val) {
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

		walk(document.body);

		//Cut text that pages add after loading
		var pending = [],
			scheduled = false;
		new MutationObserver(function(mutations) {
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
					for (var k = 0; k < nodes.length; k++) {
						if (nodes[k].isConnected) {
							walk(nodes[k]);
						}
					}
				}, 100);
			}
		}).observe(document.body, {childList: true, subtree: true});
	}

	if (!document.body) {
		return;
	}
	chrome.storage.local.get(["cutspel_runmode", "cutspel_basic", "cutspel_words"], function(settings) {
		if (settings.cutspel_runmode === "OFF" || !settings.cutspel_words) {
			return;
		}
		start(settings.cutspel_words, settings.cutspel_basic === "-1");
	});
})();
