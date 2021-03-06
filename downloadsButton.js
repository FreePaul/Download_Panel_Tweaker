// Tweaks for downloads button
var downloadsButton = {
	dpt: dpTweaker,

	handleEvent: function(e) {
		switch(e.type) {
			case "mousedown": this.handleMouseDown(e); break;
			case "mouseup":   this.handleMouseUp(e);   break;
			case "click":     this.handleClick(e);
		}
	},

	get evtSvc() {
		delete this.evtSvc;
		return this.evtSvc = Services.els // Firefox 40+
			|| Components.classes["@mozilla.org/eventlistenerservice;1"]
				.getService(Components.interfaces.nsIEventListenerService);
	},

	getButtonById: function(window, id) {
		return window.document.getElementById(id)
			|| window.gNavToolbox.palette.getElementsByAttribute("id", id)[0];
	},
	tweakDlButton: function(window, tweak, forceDestroy, dlInd) {
		var dlBtn = dlInd || this.getButtonById(window, "downloads-button");
		if(!dlBtn) {
			_log("tweakDlButton(): button not found!");
			return;
		}
		_log("tweakDlButton(" + tweak + "): #" + dlBtn.id);
		if(this.dpt.fxVersion < 27 && !dlInd) {
			dlInd = this.getButtonById(window, "downloads-indicator");
			if(dlInd)
				this.tweakDlButton(window, tweak, forceDestroy, dlInd);
			if(!dlInd || !tweak && forceDestroy)
				this.waitForDlIndicator(window, dlBtn, tweak);
		}
		this.dontHighlightButton(window, dlBtn, tweak && prefs.get("dontHighlightButton"), forceDestroy);
		this.menuButtonBehavior(window, dlBtn, tweak && prefs.get("menuButtonBehavior"), forceDestroy);
	},
	waitForDlIndicator: function(window, dlBtn, wait) {
		// Wait for #downloads-indicator (Firefox 26 and older)
		var key = "_downloadPanelTweaker_mutationObserverWaitDlIndicator";
		if(wait == key in dlBtn)
			return;
		_log("waitForDlIndicator(" + wait + ")");
		if(wait) {
			var mo = dlBtn[key] = new window.MutationObserver(function(mutations) {
				var dlInd = this.getButtonById(window, "downloads-indicator");
				if(dlInd) {
					_log("waitForDlIndicator(): appears #downloads-indicator");
					delete dlBtn[key];
					mo.disconnect();
					this.tweakDlButton(window, true, false, dlInd);
				}
			}.bind(this));
			mo.observe(dlBtn, {
				attributes: true,
				attributeFilter: ["collapsed"]
			});
		}
		else {
			var mo = dlBtn[key];
			delete dlBtn[key];
			mo.disconnect();
		}
	},
	dontHighlightButton: function(window, dlBtn, dontHL, forceDestroy) {
		var key = "_downloadPanelTweaker_mutationObserverDontHL";
		if(dontHL == key in dlBtn)
			return;
		_log("dontHighlightButton(" + dontHL + "): #" + dlBtn.id);
		if(dontHL) {
			this.removeDlAttention(dlBtn);
			var mo = dlBtn[key] = new window.MutationObserver(this.onDlAttentionChanged);
			mo.observe(dlBtn, {
				attributes: true,
				attributeFilter: ["attention"]
			});
		}
		else {
			var mo = dlBtn[key];
			delete dlBtn[key];
			mo.disconnect();
		}
	},
	get onDlAttentionChanged() {
		delete this.onDlAttentionChanged;
		return this.onDlAttentionChanged = function(mutations) {
			var dlBtn = mutations[0].target;
			this.removeDlAttention(dlBtn);
		}.bind(this);
	},
	removeDlAttention: function(dlBtn, force) {
		if(
			!dlBtn.hasAttribute("attention")
			|| "_downloadPanelTweaker_ignore" in dlBtn
		)
			return;
		dlBtn._downloadPanelTweaker_ignore = true;
		dlBtn.removeAttribute("attention");
		delete dlBtn._downloadPanelTweaker_ignore;
		_log('removeDlAttention(): remove "attention" attribute');
		var window = dlBtn.ownerDocument.defaultView;
		try {
			var dlData = window.DownloadsCommon.getIndicatorData(window);
			dlData.attentionSuppressed = true; // See DownloadsPanel.onPopupShown()
			//dlData._attentionSuppressed = dlData._attention = false;
			dlData.attentionSuppressed = false; // See DownloadsPanel.onPopupHidden()
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},
	menuButtonBehavior: function(window, dlBtn, enable, forceDestroy) {
		_log("menuButtonBehavior(" + enable + ")");
		if(enable) {
			dlBtn.addEventListener("mousedown", this, true);
			dlBtn.addEventListener("click", this, true);
		}
		else {
			dlBtn.removeEventListener("mousedown", this, true);
			dlBtn.removeEventListener("click", this, true);
		}
		var panel = window.document.getElementById("downloadsPanel");
		panel && this.menuPanelBehavior(panel, enable);
	},
	menuPanelBehavior: function(panel, enable) {
		_log("menuPanelBehavior(" + enable + ")");
		if(enable)
			panel.addEventListener("mouseup", this, true);
		else
			panel.removeEventListener("mouseup", this, true);
	},
	handleMouseDown: function(e) {
		if(e.button != 0 || e.target != e.currentTarget)
			return;
		var window = e.view;
		var dlBtn = e.target;
		if(this.buttonInMenu(dlBtn)) {
			_log("Download panel can't be opened from Australis menu");
			return;
		}
		var dt = Date.now() - this.dpt.dp.panelCloseTime;
		if(dt < 25) {
			_log("Download panel was closed " + dt + " ms ago, don't open it again");
			return;
		}
		_log(e.type + " on #" + dlBtn.id + " => toggleDownloadPanel()");
		this.dpt.da.toggleDownloadPanel(window);
		this.dpt.stopEvent(e);
	},
	buttonInMenu: function(dlBtn) {
		// See DownloadsIndicatorView.onCommand()
		return dlBtn.getAttribute("cui-areatype") == "menu-panel";
	},
	handleMouseUp: function(e) {
		if(e.button != 0)
			return;
		var trg = e.originalTarget;
		var panel = e.currentTarget;
		var window = e.view;
		var anchor = panel.anchorNode;
		if(anchor) {
			var btn = this.getButtonFromChild(anchor) || anchor;
			var bo = btn.boxObject;
			var border = 2;
			if(
				e.screenX >= bo.screenX - border
				&& e.screenX <= bo.screenX + bo.width + border
				&& e.screenY >= bo.screenY - border
				&& e.screenY <= bo.screenY + bo.height + border
			) {
				_log(e.type + ": ignore in #" + btn.id + " coordinates");
				return;
			}
		}
		var nativeEvent = false;
		function waitNativeEvent(e) {
			_dbgv && _log(e.type + " in #" + panel.id + " => do nothing");
			destroy();
			nativeEvent = true;
		}
		function destroy() {
			window.removeEventListener("click", waitNativeEvent, true);
			window.removeEventListener("command", waitNativeEvent, true);
			window.clearTimeout(timer);
		}
		window.addEventListener("click", waitNativeEvent, true);
		window.addEventListener("command", waitNativeEvent, true);
		var timer = window.setTimeout(function() {
			destroy();
			if(nativeEvent)
				return;
			var hasCmdListener = this.evtSvc.hasListenersFor(trg, "command");
			var _evt = e.type + " in #" + panel.id + " => ";
			if(hasCmdListener) {
				_log(_evt + "doCommand()");
				trg.doCommand();
				this.dpt.dp.panelClick(e);
			}
			else if(trg.localName == "button" && trg.type == "menu") {
				_log(_evt + "toggle button.open");
				trg.open = !trg.open;
			}
			else {
				_log(_evt + "click()");
				trg.click();
			}
		}.bind(this), 0);
	},
	getButtonFromChild: function(child) {
		for(var btn = child; btn; btn = btn.parentNode)
			if(btn.localName == "toolbarbutton")
				return btn;
		return null;
	},
	handleClick: function(e) {
		if(e.button != 0 || e.target != e.currentTarget || this.buttonInMenu(e.target))
			return;
		_log("Prevent " + e.type + " on #" + e.target.id);
		this.dpt.stopEvent(e); // Also stops "command" event
	}
};