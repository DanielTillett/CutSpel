/*
    Copyright (c) 2014 Daniel Tillett & Junling Guo

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

// Number of rows at the top of cutspel.csv that make up Basic mode
var FAST_COUNT = 780;

// Parse the word list into [traditional, cut, isBasic] entries and store it
function loadWordList() {
	return fetch(chrome.runtime.getURL("cutspel.csv"))
		.then(function(response) { return response.text(); })
		.then(function(text) {
			var rows = text.split(/\r?\n/),
				words = [];
			for (var i = 0; i < rows.length; i++) {
				var columns = rows[i].split(",");
				if (columns.length >= 2) {
					var key = columns[0].replace(/"/g, "").trim().toLowerCase();
					var value = columns[1].replace(/"/g, "").trim();
					if (key && value && key !== value) {
						words.push([key, value, i < FAST_COUNT]);
					}
				}
			}
			return chrome.storage.local.set({cutspel_words: words});
		});
}

function updateIcon(mode) {
	return chrome.action.setIcon({path: (mode === "OFF" ? "OFF" : "ON") + ".png"});
}

//Load word list into storage, keeping the user's settings across updates
chrome.runtime.onInstalled.addListener(function() {
	chrome.storage.local.get(["cutspel_runmode", "cutspel_basic"]).then(function(settings) {
		var defaults = {};
		if (!settings.cutspel_runmode) {
			defaults.cutspel_runmode = "ON";
		}
		if (!settings.cutspel_basic) {
			defaults.cutspel_basic = String(FAST_COUNT);
		}
		return chrome.storage.local.set(defaults).then(function() {
			return updateIcon(settings.cutspel_runmode || "ON");
		});
	});
	loadWordList();
});

chrome.runtime.onStartup.addListener(function() {
	chrome.storage.local.get("cutspel_runmode").then(function(settings) {
		updateIcon(settings.cutspel_runmode);
	});
});

//Switch CutSpel on and off, then reload the active tab
chrome.action.onClicked.addListener(function(tab) {
	chrome.storage.local.get("cutspel_runmode").then(function(settings) {
		var mode = settings.cutspel_runmode === "OFF" ? "ON" : "OFF";
		return chrome.storage.local.set({cutspel_runmode: mode}).then(function() {
			updateIcon(mode);
			if (tab && tab.id !== undefined) {
				chrome.tabs.reload(tab.id);
			}
		});
	});
});
