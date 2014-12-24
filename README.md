define.js
==============

A Senseless Module Loader: Use Ajax &amp; eval

1. Use Ajax to load a module
2. Checkout the dependencies of the loaded module
3. Create the dependencies module group
4. Backto step 1
5. After all the dependencies complete, eval the module
6. Stop if the process backward to the root


API
===============
###1. define: function
    @param function | string，如果是string，define会首先以string生成url，去load对应的js文件，作为主模块
    @desc 唯一暴露的方法，也是整个依赖的开始
    @use define(function() {/*function body*/}) | define("test/test.js")

###2. define.config: object
    @value {
      "base": string || "/" // 模块的baseUrl
    }
    @desc define的配置信息，目前只有base

###3. require: function
    @param string，模块url，注意加上后缀
    @desc 加载依赖模块，与seajs一样，所有require都会在模块执行前先加载，且不具有if...else...条件加载
    @return 模块，实际上就是模块中exports的东西
    @use require("test/test.js")

###4. exports
    @desc 模块中使用，用于将模块的接口/数据暴露，直接使用，不用在模块中声明
    @use exports.a = 1，a就是模块要暴露的方法/属性

Use
===============
    // test.js
    var a = 1, b = 2
    exports.b = 2; // use exports to export b to caller
    var f = {}
    console.log(a)
    f.test = function(){
      setTimeout(function() {
    	console.log(exports.b)
      }, 0)
    }
    f.test()
    exports.f = f;
    
    // test2.js
    var t = require("test/test.js");
    ++t.b
    t.f.test();
    exports.test = function() {
      console.log(++t.b)
    }
    
    // 使用：
    <script type="text/javascript">
      define.config.base = "./"
      define(function() {
    	var e = require("test/test2.js");
    	e.test()
      })
      // 结果：console.log出 1 2 3 4
    </script>
