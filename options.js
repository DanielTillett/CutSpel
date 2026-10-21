/*
    Copyright (c) 2016 Daniel Tillett & Junling Guo

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

//Controls if Basic or Full Mode is used
document.addEventListener("DOMContentLoaded", function() {
	var radios = document.querySelectorAll("input[name='mode']");

	chrome.storage.local.get("cutspel_basic", function(settings) {
		if (settings.cutspel_basic) {
			for (var i = 0; i < radios.length; i++) {
				radios[i].checked = (radios[i].value === settings.cutspel_basic);
			}
		}
	});

	for (var i = 0; i < radios.length; i++) {
		radios[i].addEventListener("change", function() {
			chrome.storage.local.set({cutspel_basic: this.value});
		});
	}

	//Automatic mode needs all-sites access, which Chrome only grants from a click
	var auto = document.getElementById("auto_mode"),
		allSites = {origins: ["<all_urls>"]};

	function showAuto() {
		Promise.all([chrome.storage.local.get("cutspel_auto"), chrome.permissions.contains(allSites)]).then(function(results) {
			auto.checked = results[0].cutspel_auto === true && results[1];
		});
	}
	showAuto();
	chrome.storage.onChanged.addListener(function(changes, area) {
		if (area === "local" && changes.cutspel_auto) {
			showAuto();
		}
	});

	auto.addEventListener("change", function() {
		if (auto.checked) {
			chrome.permissions.request(allSites).then(function(granted) {
				auto.checked = granted;
				return chrome.storage.local.set({cutspel_auto: granted});
			});
		} else {
			chrome.storage.local.set({cutspel_auto: false}).then(function() {
				return chrome.permissions.remove(allSites);
			});
		}
	});
});
