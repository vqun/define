var a = 1
var b = 2
exports.b = 2;
var f = {}
console.log(a)
f.test = function(){
	setTimeout(function() {
		console.log(exports.b)
	}, 0)
}
f.test()
exports.f = f;