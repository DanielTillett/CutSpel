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

  $.fn.replaceWords = function(words, cut, regex) {
    return this.each(function(){
      var node = this.firstChild,
        val,
        new_val,
        lc_val,
        length = words.length;
    
      //Continue if firstChild exists.
      if (node) {
        // Loop over all childNodes.
        do {
          // Only process text nodes.
          if (node.nodeType === 3 && node.length > 1) {
            // The original node value.
            val = node.nodeValue;
            new_val = val;
            //convert to lowercase since indexOf is case insensistive
            lc_val = val.toLowerCase();
            for (i=0; i < length; i++) {
            	if (lc_val.indexOf(words[i]) >= 0) {
            		new_val = new_val.replaceWithCase(regex[i], cut[i]);
					}
				}
            // Only replace text if the new value is actually different!
            if (new_val !== val) {
              	if (! /</.test(new_val)) {
                	node.nodeValue = new_val;
              	} 
            }
          }  
        } while ( node = node.nextSibling );
      }
    });
  };  

//Keep capitalization of words.
String.prototype.replaceWithCase=function(subStr, newStr){
 	return this.replace(subStr, function(found) {
  		return /[A-Z]/.test(found.charAt(0))?( newStr.charAt(0).toUpperCase() + newStr.substring(1) ) : newStr.toLowerCase();
 	});  
}

//Load word list into local storage
chrome.runtime.onInstalled.addListener(function(install) {
	var fast_count = 780;
	var csvUrl = chrome.runtime.getURL("cutspel.csv");
	$.ajax({
		url:csvUrl,
		type:"text",
		success:function(result){
			var rows = result.split("\n");
            for (var i = 0; i < rows.length; i ++) {
                var columns = rows[i].split(",");
                if  (columns != null && columns.length >= 2) {
                    var key = $.trim(columns[0]);
					key = key.replace(/"/g, "")
                    var value = $.trim(columns[1]);
					value = value.replace(/"/g, "")
                    if (key !== value) {
                    	//add underscore to fast mode values 
                    	if (i < fast_count) {
                    		value = '_' + value;
                    	}
                        localStorage.setItem(key, value);
                    }
                }
            }
		}
	});
	localStorage.setItem("cutspel_runmode","ON");
	localStorage.setItem("cutspel_basic",fast_count);
	chrome.browserAction.setIcon({path:localStorage.getItem("cutspel_runmode")+".png"});
});

chrome.runtime.onStartup.addListener(function(){
	//replaces = localStorage();
	chrome.browserAction.setIcon({path:localStorage.getItem("cutspel_runmode")+".png"});
});

//Switch CutSpel on and off 
chrome.browserAction.onClicked.addListener(function(){
	var mode = localStorage.getItem("cutspel_runmode");
	if (mode == "ON") {
		localStorage.setItem("cutspel_runmode","OFF");
		chrome.tabs.query({status:"complete", active:true}, function(tabs){
			if (tabs != null && tabs.length > 0) {
				for (var i = 0; i < tabs.length; i ++ ) {
					chrome.tabs.reload(tabs[i].id);
				}
			}
		});
	} else {
		localStorage.setItem("cutspel_runmode","ON");
		chrome.tabs.query({status:"complete", active: true}, function(tabs){
			if (tabs != null && tabs.length > 0) {
				for (var i = 0; i < tabs.length; i ++ ) {
					chrome.tabs.reload(tabs[i].id);
				}
			}
		});
	}
	chrome.browserAction.setIcon({path:localStorage.getItem("cutspel_runmode")+".png"});
});

function clearLocalstorage(){
	var mode = localStorage.getItem("cutspel_runmode");
	var partial = localStorage.setItem("cutspel_basic");
    localStorage.clear();
	localStorage.setItem("cutspel_runmode", mode);
	localStorage.setItem("cutspel_basic", partial);
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	var mode = localStorage.getItem("cutspel_runmode");
	if (mode == "OFF") {
		return;
	}
	//var start = window.performance.now();
	if (message.action == "replace") {
		var index,
			value,
			fast_flag; 
			i = 0,
			cut = [],
			words = [],
			regex = [],
			partial = localStorage.getItem("cutspel_basic"),
			div = jQuery(document.createElement("div"));
		
		div.html(message.content);	
		
		//Get length of library to use
		if (partial == "-1") {
				partial = localStorage.length;
			} 
		else {
			partial = parseInt(partial);
			}
		
		//Convert content to lowercase as indexOf is case sensitive
		var lowerMessage = $(message.content.toLowerCase()).text();

		//Create array based only on words present on page
		for (var j = 0; j < localStorage.length; j++) {
			index = localStorage.key(j);
			value = localStorage.getItem(index);
			//Partial library values have _ which need to be removed
			if (value[0] === '_') {
				value = value.replace('_','');
				fast_flag = true;
			}
			else {
				fast_flag = false;
			}
			if (partial ===  localStorage.length || fast_flag) {
				if (lowerMessage.indexOf(index) >= 0) {
					cut[i] = value;
					words[i] = index;
					i++;
				}
			}
		}

		//Construct regex array from word list
	 	for (i=0; i < words.length; i++) {
       		regex[i] = new RegExp('(?!<.*?)\\b(' + words[i] + ')\\b(?![^<>]*?(</a>|>))', "gi");
		}
		
		//Update text
		div.find("*").replaceWords(words, cut, regex);

		sendResponse({action:"replaced", content:div.html()});
		//var end = window.performance.now();
		//alert(end-start);
	}
});
