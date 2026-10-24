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

//The MV3 service worker has no DOM, so text is now replaced here in the page
(function() {

	//Keep capitalization of words.
	function replaceWithCase(str, subStr, newStr) {
		return str.replace(subStr, function(found) {
			return /[A-Z]/.test(found.charAt(0)) ? ( newStr.charAt(0).toUpperCase() + newStr.substring(1) ) : newStr.toLowerCase();
		});
	}

	//Text in these elements is not page prose and is left alone
	var skipTags = { SCRIPT: true, STYLE: true, NOSCRIPT: true, TEXTAREA: true };

	function replaceWords(root, words, cut, regex) {
		var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: function(node) {
				if (node.parentNode && skipTags[node.parentNode.nodeName]) {
					return NodeFilter.FILTER_REJECT;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		});
		var node,
			val,
			new_val,
			lc_val,
			length = words.length;

		while (node = walker.nextNode()) {
			if (node.length > 1) {
				// The original node value.
				val = node.nodeValue;
				new_val = val;
				//convert to lowercase since indexOf is case sensitive
				lc_val = val.toLowerCase();
				for (var i = 0; i < length; i++) {
					if (lc_val.indexOf(words[i]) >= 0) {
						new_val = replaceWithCase(new_val, regex[i], cut[i]);
					}
				}
				// Only replace text if the new value is actually different!
				if (new_val !== val && ! /</.test(new_val)) {
					node.nodeValue = new_val;
				}
			}
		}
	}

	chrome.storage.local.get(["cutspel_runmode", "cutspel_basic", "cutspel_words"], function(items) {
		if (items.cutspel_runmode == "OFF" || !items.cutspel_words || !document.body) {
			return;
		}
		var library = items.cutspel_words,
			full = (items.cutspel_basic == "-1"),
			cut = [],
			words = [],
			regex = [],
			value,
			fast_flag;

		//Convert content to lowercase as indexOf is case sensitive
		var lowerMessage = document.body.textContent.toLowerCase();

		//Create array based only on words present on page
		for (var index in library) {
			value = library[index];
			//Partial library values have _ which need to be removed
			if (value[0] === '_') {
				value = value.replace('_','');
				fast_flag = true;
			}
			else {
				fast_flag = false;
			}
			if (full || fast_flag) {
				if (lowerMessage.indexOf(index) >= 0) {
					cut.push(value);
					words.push(index);
				}
			}
		}

		//Construct regex array from word list
		for (var i = 0; i < words.length; i++) {
			regex[i] = new RegExp('(?!<.*?)\\b(' + words[i] + ')\\b(?![^<>]*?(</a>|>))', "gi");
		}

		//Update text
		replaceWords(document.body, words, cut, regex);
	});

})();
