/**
 * @description 创建一个类
 * @param {String}    fullClassName  类全名，包括命名空间。
 * @param {Plain}     defines        要创建的类的特性
 *     defines.constructor  {Function}       类的构造函数，实例化的时候会被调用。
 *     defines.base         {String}         基类的名称。名称要使用全名。（因为base是javascript未来保留字，所以不用base）
 *     defines.mixin        {Array<String>}  要混合到新类的类集合
 *     defines.<method>     {Function}       其他类方法
 *
 * TODO:
 *     Mixin 构造函数调用支持
 */
(function () {

    var debug = true;

    // just to bind context
    Function.prototype.bind = Function.prototype.bind || function (thisObj) {
        var args = Array.prototype.slice.call(arguments, 1);
        return this.apply(thisObj, args);
    };

    // 方便调试查看
    if (debug) {
        var origin = Object.prototype.toString;
        Object.prototype.toString = function () {
            return this.__MDeditorClassName || origin.call(this);
        };
    }

    // 所有类的基类
    function Class() {
    }

    Class.__MDeditorClassName = 'Class';

    function getCallerClass(instance, caller) {
        var currentClass = instance.constructor;
    }

    // 提供 base 调用支持
    Class.prototype.base = function (name) {
        var caller = arguments.callee.caller;
        var method = caller.__MDeditorMethodClass.__MDeditorBaseClass.prototype[ name ];
        return method.apply(this, Array.prototype.slice.call(arguments, 1));
    };

    // 直接调用 base 类的同名方法
    Class.prototype.callBase = function () {
        var caller = arguments.callee.caller;
        var method = caller.__MDeditorMethodClass.__MDeditorBaseClass.prototype[ caller.__MDeditorMethodName ];
        return method.apply(this, arguments);
    };

    Class.prototype.mixin = function (name) {
        var caller = arguments.callee.caller;
        var mixins = caller.__MDeditorMethodClass.__MDeditorMixins;
        if (!mixins) {
            return this;
        }
        var method = mixins[ name ];
        return method.apply(this, Array.prototype.slice.call(arguments, 1));
    };

    Class.prototype.callMixin = function () {
        var caller = arguments.callee.caller;
        var methodName = caller.__MDeditorMethodName;
        var mixins = caller.__MDeditorMethodClass.__MDeditorMixins;
        if (!mixins) {
            return this;
        }
        var method = mixins[ methodName ];
        if (methodName == 'constructor') {
            for (var i = 0, l = method.length; i < l; i++) {
                method[ i ].call(this);
            }
            return this;
        } else {
            return method.apply(this, arguments);
        }
    };

    Class.prototype.pipe = function (fn) {
        if (typeof ( fn ) == 'function') {
            fn.call(this, this);
        }
        return this;
    };

    Class.prototype.getType = function () {
        return this.__MDeditorClassName;
    };

    // 检查基类是否调用了父类的构造函数
    // 该检查是弱检查，假如调用的代码被注释了，同样能检查成功（这个特性可用于知道建议调用，但是出于某些原因不想调用的情况）
    function checkBaseConstructorCall(targetClass, classname) {
        var code = targetClass.toString();
        if (!/this\.callBase/.test(code)) {
            throw new Error(classname + ' : 类构造函数没有调用父类的构造函数！为了安全，请调用父类的构造函数');
        }
    }

    function checkMixinConstructorCall(targetClass, classname) {
        var code = targetClass.toString();
        if (!/this\.callMixin/.test(code)) {
            throw new Error(classname + ' : 类构造函数没有调用父类的构造函数！为了安全，请调用父类的构造函数');
        }
    }

    var MDEDITOR_INHERIT_FLAG = '__MDEDITOR_INHERIT_FLAG_' + ( +new Date() );

    function inherit(constructor, BaseClass, classname) {
        var MDeditorClass = eval('(function ' + classname + '( __inherit__flag ) {' +
        'if( __inherit__flag != MDEDITOR_INHERIT_FLAG ) {' +
        'MDeditorClass.__MDeditorConstructor.apply(this, arguments);' +
        '}' +
        'this.__MDeditorClassName = MDeditorClass.__MDeditorClassName;' +
        '})');
        MDeditorClass.__MDeditorConstructor = constructor;

        MDeditorClass.prototype = new BaseClass(MDEDITOR_INHERIT_FLAG);

        for (var methodName in BaseClass.prototype) {
            if (BaseClass.prototype.hasOwnProperty(methodName) && methodName.indexOf('__MDeditor') !== 0) {
                MDeditorClass.prototype[ methodName ] = BaseClass.prototype[ methodName ];
            }
        }

        MDeditorClass.prototype.constructor = MDeditorClass;

        return MDeditorClass;
    }

    function mixin(NewClass, mixins) {
        if (false === mixins instanceof Array) {
            return NewClass;
        }

        var i, length = mixins.length,
            proto, method;

        NewClass.__MDeditorMixins = {
            constructor: []
        };

        for (i = 0; i < length; i++) {
            proto = mixins[ i ].prototype;

            for (method in proto) {
                if (false === proto.hasOwnProperty(method) || method.indexOf('__MDeditor') === 0) {
                    continue;
                }
                if (method === 'constructor') {
                    // constructor 特殊处理
                    NewClass.__MDeditorMixins.constructor.push(proto[ method ]);
                } else {
                    NewClass.prototype[ method ] = NewClass.__MDeditorMixins[ method ] = proto[ method ];
                }
            }
        }

        return NewClass;
    }

    function extend(BaseClass, extension) {
        if (extension.__MDeditorClassName) {
            extension = extension.prototype;
        }
        for (var methodName in extension) {
            if (extension.hasOwnProperty(methodName) &&
                methodName.indexOf('__MDeditor') &&
                methodName != 'constructor') {
                var method = BaseClass.prototype[ methodName ] = extension[ methodName ];
                method.__MDeditorMethodClass = BaseClass;
                method.__MDeditorMethodName = methodName;
            }
        }
        return BaseClass;
    }

    MD.createClass = function (classname, defines) {
        var constructor, NewClass, BaseClass;

        if (arguments.length === 1) {
            defines = arguments[ 0 ];
            classname = 'AnonymousClass';
        }

        BaseClass = defines.base || Class;

        if (defines.hasOwnProperty('constructor')) {
            constructor = defines.constructor;
            if (BaseClass != Class) {
                checkBaseConstructorCall(constructor, classname);
            }
        } else {
            constructor = function () {
                this.callBase.apply(this, arguments);
                this.callMixin.apply(this, arguments);
            };
        }

        NewClass = inherit(constructor, BaseClass, classname);
        NewClass = mixin(NewClass, defines.mixins);

        NewClass.__MDeditorClassName = constructor.__MDeditorClassName = classname;
        NewClass.__MDeditorBaseClass = constructor.__MDeditorBaseClass = BaseClass;

        NewClass.__MDeditorMethodName = constructor.__MDeditorMethodName = 'constructor';
        NewClass.__MDeditorMethodClass = constructor.__MDeditorMethodClass = NewClass;

        // 下面这些不需要拷贝到原型链上
        delete defines.mixins;
        delete defines.constructor;
        delete defines.base;

        NewClass = extend(NewClass, defines);

        return NewClass;
    };

    MD.extendClass = extend;

})();