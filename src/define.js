// Http: the ajax module, very simple
(function(Global, undefined) {
	var CONFIG = {
		"method": "GET",
		"data": {},
		"charset": "UTF-8",
		"type": "json",
		"ansyc": true,
		"header": {},
		"success": emptyFunc,
		"fail": emptyFunc,
		"requesting": emptyFunc,
		"timeout": 60*1000
	};
	Global.Http = function() {
		this.xhr = XHR();
	}
	Global.Http.prototype.request = function(url, conf) {
		if(!url && !$.is(url, "string")) {
			throw new Error("Need A Request URL")
		}
		var xhr = this.xhr||XHR();
		if(!xhr) {return false}
		var config = parseParam(CONFIG, conf);
		config.method = config.method.toUpperCase();
		if(!config["header"]["Content-Type"]){
			config["header"]["Content-Type"] = "application/x-www-form-urlencoded";
		}
		if(!config["header"]["X-Requested-With"]){
			config["header"]["X-Requested-With"] = "XMLHttpRequest";
		}
		var isGet = !!(config.method=="GET");
		var ds = [];
		forEach(config.data, function(key, value) {
			ds.push(key+"="+value)
		});
		var data = ds.join("&");
		var callback = function() {
			if(xhr.readyState==4) {
				clearTimeout(tout);
				var res = getResponse(config.type, xhr);
				if(xhr.status>=200&&xhr.status<400){
					config.success(res, xhr)
				}else{
					config.fail(null, xhr)
				}
			}else{
				config.requesting(xhr.readyState)
			}
		}
		if(config.ansyc) {
			xhr.onreadystatechange = callback
		}
		xhr.open(config.method, url+(isGet&&data?"?"+data:""), config.ansyc);
		forEach(config.header, function(key, value) {
			xhr.setRequestHeader(key, value);
			return value
		});
		var tout = setTimeout(function() {
			xhr.abort()
			config.fail(null, xhr)
		}, config.timeout)
		isGet ? xhr.send() : xhr.send(data);
	}
	Global.Http.prototype.abort = function() {
		this.xhr.abort()
	}
	Global.Http.request = function(url, conf) {
		var http = new Http();
		http.request(url, conf);
		return http
	}
	function XHR() {
		var xhr = null;
		try{
			xhr = new XMLHttpRequest()
		}catch(e) {
			try{
				xhr = new ActiveXObject("Msxml2.XMLHTTP")
			}catch(e){
				try{
					xhr = new ActiveXObject("Microsoft.XMLHTTP")
				}catch(e){
					xhr = null
				}
			}
		}
		return xhr
	}
	function getResponse(type, xhr) {
		var res = null;
		if(type=="json") {
			res = xhr.responseText&&$.is(xhr.responseText, "string") ? eval("("+xhr.responseText+")") : {}
		}else if(type=="text") {
			res = xhr.responseText
		}else if(type=="xml") {
			res = xhr.responseXML
		}
		return res
	}
	function forEach(who, handler, type) {
		if(who.constructor == Array){
			var re = [];
			for(var k = 0, len = who.length; k < len; k++) {
				re.push(handler(k, who[k]))
			}
		}else{
			re = {};
			for(var j in who) {
				re[j] = handler(j, who[j])
			}
		}
		return re;
	}
	function parseParam(src, obj) {
		return forEach(src, function(key, value) {
			return obj[key]||value
		})
	}
	function emptyFunc() {}
})(this);

(function(Global, undefined) {
	var REGEXP = {
		"jsComment": /((\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*))/gm,
		"module": /([\r\n]?\s*var\s+(.+)\s*=\s*)?require\(['"]\s*([^\s]+)\s*['"]\)/gm,
		"funcBody": /function\s*\([^\r\n]*\)\s*\{\s*((.|\s)*)\}/gm
	}
	var Code_Settup = {
		"prefix": "var __Saber_defined__temp__ = (function(){var exports = {};",
		"postfix": ";return exports})()"
	}

	var COMMON = {
		"moduleIdPrefix": "__Saber__defined__"
	}
	// The completedModules are all the modules those are evaled
	// The loadingModules are the modules those are loading or evaling
	var Cached = {
		"completedModules": {},
		"loadingModules": {},
		"modules": {},
		"moduleInterfaces": {}
	}
	// The main
	function define(mod) {
		// mod can be a function to mark as a native module
		// and a module path as a remote module to be requested use Http
		var isNative = typeof mod === "function";
		if(isNative) {
			var _mod = mod.toString().replace(REGEXP.funcBody, "$1")||"";
			mod = new Date().getTime();
		}
		var modID = COMMON.moduleIdPrefix + mod;
		var module = Cached.modules[modID] || (Cached.modules[modID] = new Module(mod, modID));
		module.parents.push(this);
		// If the module was already completed, just notice the dependenting module
		if(Cached.completedModules[modID]) {
			module.notice();
			return "complete"
		}
		// If the module is loading, just waiting for loading
		if(Cached.loadingModules[modID]) {
			return "loading"
		}
		Cached.loadingModules[modID] = module;
		if(isNative) {
			module.defined(_mod);
			return "loading"
		}
		var http = new Http();
		http.request(define.config.base + module.mod, {
			"method": "GET",
			"type": "text",
			"success": function(_mod, xhr) {
				module.defined(_mod)
			}
		})
		return "loading"
	}
	define.config = {
		"base": "/"
	}
	function Module(mod, id) {
		this.mod = mod;
		this.parents = [];
		this.moduleCode = ""; // module code for eval after all the dependencies complete
		this.id = id;
		this.dependencies = [];
		this.dependent = 0;
		this.uncomplete = 0;
		this.lock = false;
		this.queue = [];
		this.dependencyNameModule = []; // exposed interfaces
	}
	Module.prototype.defined = function(module) {
		var modCode = module.toString();
		// 1. delete the comments
		modCode = RemoveComments(modCode);
		this.moduleCode = modCode;
		// 2. find out the dependent modules
		var depModulesInfo = CheckoutModules(modCode);
		this.moduleCode = depModulesInfo.mod;
		this.dependencies = depModulesInfo.depModules;
		this.dependencyNameModule = depModulesInfo.dependencyNameModule;
		this.dependent = this.uncomplete = depModulesInfo.depModules.length;
		depModulesInfo = null;
		if(!this.dependent) {
			return this.eval();
		}
		// 3. manipulate the modules
		for(var k = this.dependent;k;) {
			define.call(this, this.dependencies[--k])
		}
	}
	Module.prototype.complete = function(mod) {
		if(this.lock) {
			this.queue.push(mod);
			return "complete_waiting"
		}
		this.lock = true;
		if(!(--this.uncomplete)) {
			return this.eval()
		}else {
			this.lock = false;
			var nextMod = this.queue.shift();
			this.complete(nextMod);
			return "dealing"
		}
	}
	Module.prototype.eval = function() {
		var interfaceFixed = "";
		for(var k = 0,len=this.dependent;k<len;k++) {
			var curr = this.dependencyNameModule[k];
			curr["name"] && (
				interfaceFixed += "var " + curr["name"] + "=" +
				"Cached.moduleInterfaces[\"" +
				COMMON.moduleIdPrefix +
				curr["module"]+"\"];"
			);
		}
		eval(
			Code_Settup.prefix+
			interfaceFixed+
			this.moduleCode+
			Code_Settup.postfix
		);
		Cached.moduleInterfaces[this.id] = __Saber_defined__temp__;
		__Saber_defined__temp__ = null;

		Cached.completedModules[this.id] = true;
		Cached.loadingModules[this.id] = undefined;
		return this.notice();
	}
	Module.prototype.notice = function() {
		var parents = this.parents;
		var that = this;
		for(var k = 0, len = parents.length;k<len;k++){
			var currParent = parents[k];
			setTimeout(function(){
				if(currParent === Global) {
					return "completed"
				}
				currParent.complete(that);
				return "dealing"
			}, 0)
		}
		return true
	}
	Global.define = define;
	Global.require = function() {};
	function RemoveComments(str) {
		return str.replace(REGEXP.jsComment, "")
		//.replace(/(^\r|\n$)|^\s+|\s+$/gm, ";")
	}
	function CheckoutModules(mod) {
		var ret = {};
		ret.depModules = [];
		ret.dependencyNameModule = [];
		var _mod = null;
		ret.mod = mod.replace(REGEXP.module, function(m0,m1,m2,m3) {
			ret.depModules.push(m3);
			ret.dependencyNameModule.push({
				"name": m2,
				"module": m3
			});
			return ""
		})
		return ret
	}
})(this)