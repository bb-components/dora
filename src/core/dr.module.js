//模块注册&暴露模块接口
(function () {
    var _modules;
    DR.registerModule = function (name, module) {
        //初始化模块列表
        if (!_modules) {
            _modules = {};
        }
        _modules[ name ] = module;
    };
    DR.getModules = function () {
        return _modules;
    };
})();