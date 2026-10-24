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

//Load word list into chrome.storage (service workers have no localStorage)
chrome.runtime.onInstalled.addListener(function(install) {
	var fast_count = 780;
	var csvUrl = chrome.runtime.getURL("cutspel.csv");
	fetch(csvUrl)
		.then(function(response) { return response.text(); })
		.then(function(result) {
			var words = {};
			var rows = result.split("\n");
            for (var i = 0; i < rows.length; i ++) {
                var columns = rows[i].split(",");
                if  (columns != null && columns.length >= 2) {
                    var key = columns[0].trim().replace(/"/g, "");
                    var value = columns[1].trim().replace(/"/g, "");
                    if (key !== value) {
                    	//add underscore to fast mode values
                    	if (i < fast_count) {
                    		value = '_' + value;
                    	}
                        words[key] = value;
                    }
                }
            }
			return chrome.storage.local.set({cutspel_words: words});
		});

	//Keep the user's settings when the extension is updated
	chrome.storage.local.get(["cutspel_runmode", "cutspel_basic"], function(items) {
		var settings = {
			cutspel_runmode: items.cutspel_runmode || "ON",
			cutspel_basic: items.cutspel_basic || String(fast_count)
		};
		chrome.storage.local.set(settings);
		chrome.action.setIcon({path: settings.cutspel_runmode + ".png"});
	});
});

chrome.runtime.onStartup.addListener(function(){
	chrome.storage.local.get("cutspel_runmode", function(items) {
		chrome.action.setIcon({path: (items.cutspel_runmode || "ON") + ".png"});
	});
});

//Switch CutSpel on and off
chrome.action.onClicked.addListener(function(){
	chrome.storage.local.get("cutspel_runmode", function(items) {
		var mode = (items.cutspel_runmode == "OFF") ? "ON" : "OFF";
		chrome.storage.local.set({cutspel_runmode: mode}, function() {
			chrome.action.setIcon({path: mode + ".png"});
			chrome.tabs.query({status:"complete", active:true}, function(tabs){
				if (tabs != null && tabs.length > 0) {
					for (var i = 0; i < tabs.length; i ++ ) {
						chrome.tabs.reload(tabs[i].id);
					}
				}
			});
		});
	});
});
