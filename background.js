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

var ALL_SITES = {origins: ["<all_urls>"]};
var AUTO_SCRIPT = {
	id: "cutspel-auto",
	matches: ["<all_urls>"],
	excludeMatches: ["*://*.google.com/*"],
	js: ["context-script.js"],
	runAt: "document_idle"
};

//Green icon on tabs CutSpel has cut, grey everywhere else
function setTabIcon(tabId, cut) {
	return chrome.action.setIcon({tabId: tabId, path: cut ? "ON.png" : "OFF.png"}).catch(function() {});
}

//Register the automatic content script only while automatic mode is on and all-sites access is granted
function syncAutoScript() {
	return Promise.all([
		chrome.storage.local.get("cutspel_auto"),
		chrome.permissions.contains(ALL_SITES),
		chrome.scripting.getRegisteredContentScripts({ids: [AUTO_SCRIPT.id]})
	]).then(function(results) {
		var wanted = results[0].cutspel_auto === true && results[1],
			registered = results[2].length > 0;
		if (wanted && !registered) {
			return chrome.scripting.registerContentScripts([AUTO_SCRIPT]);
		}
		if (!wanted && registered) {
			return chrome.scripting.unregisterContentScripts({ids: [AUTO_SCRIPT.id]});
		}
	});
}

//Load word list into storage, keeping the user's settings across updates
chrome.runtime.onInstalled.addListener(function(details) {
	Promise.all([
		chrome.storage.local.get(["cutspel_auto", "cutspel_basic"]),
		chrome.permissions.contains(ALL_SITES)
	]).then(function(results) {
		var settings = results[0],
			defaults = {};
		if (settings.cutspel_auto === undefined) {
			//Keep pages cutting automatically for existing users whose all-sites access carried over
			defaults.cutspel_auto = details.reason === "update" && results[1];
		}
		if (!settings.cutspel_basic) {
			defaults.cutspel_basic = String(FAST_COUNT);
		}
		return chrome.storage.local.set(defaults);
	}).then(syncAutoScript);
	chrome.storage.local.remove("cutspel_runmode");
	loadWordList();
});

chrome.runtime.onStartup.addListener(syncAutoScript);

chrome.storage.onChanged.addListener(function(changes, area) {
	if (area === "local" && changes.cutspel_auto) {
		syncAutoScript();
	}
});

//Turn automatic mode off if all-sites access is withdrawn (e.g. from chrome://extensions)
chrome.permissions.onRemoved.addListener(function() {
	chrome.permissions.contains(ALL_SITES).then(function(granted) {
		if (!granted) {
			chrome.storage.local.set({cutspel_auto: false});
		}
	});
});

//Cut the current page, or restore it if it is already cut
chrome.action.onClicked.addListener(function(tab) {
	if (tab && tab.id !== undefined) {
		chrome.scripting.executeScript({target: {tabId: tab.id}, files: ["context-script.js"]}).catch(function() {
			//Chrome does not allow extensions on some pages, such as chrome:// and the Web Store
		});
	}
});

//The content script reports whether its page is cut
chrome.runtime.onMessage.addListener(function(message, sender) {
	if (message.action === "cutspel_state" && sender.tab) {
		setTabIcon(sender.tab.id, message.cut);
	}
});

chrome.tabs.onUpdated.addListener(function(tabId, info) {
	if (info.status === "loading") {
		setTabIcon(tabId, false);
	}
});
