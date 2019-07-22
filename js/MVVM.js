//观察者 (发布订阅) 观察者 被观察者
class Dep {
    constructor() {
        this.subs = [];
    }
    //订阅
    addSub(watcher) { //添加watcher
        this.subs.push(watcher);
    }
    //发布
    notify() {
        this.subs.forEach(watcher => watcher.update());
    }
}
class Watcher {
    constructor(vm, expr, cb) {
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        //默认存放一个老值
        this.oldValue = this.get();
    }
    get() {
        Dep.target = this;//先把自己放到this上
        //取值 把这个观察者 和数据关联起来
        let value = CompileUtil.getVal(this.vm, this.expr);
        Dep.target = null; //不取消 任何值取值 都会添加watcher
        return value;
    }
    update() {//数据变化后 会调用观察者的update方法
        let newVal = CompileUtil.getVal(this.vm, this.expr);
        if (newVal !== this.oldValue) {
            this.cb(newVal);
        }
    }
}
// vm.$watch(vm,'school.name',(newVal)=>{ 观察者就像这个值一变就会出发事件

// })

class Observer {
    constructor(data) {
        this.observer(data);
    }
    observer(data) {
        //如果是对象才观察
        if (data && typeof data == "object") {
            //如果是对象
            for (let key in data) {
                this.defineReactive(data, key, data[key]);
            }
        }
    }
    defineReactive(obj, key, value) { //school:[watcher,watcher] b:[watcher]
        this.observer(value);
        let dep = new Dep(); //给每个属性 都加上一个具有发布订阅的功能
        Object.defineProperty(obj, key, {
            get() {
                //创建watcher时 会取到对应的内容，并且把watcher放到了全局上
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set: (newVal) => {//school:{name:1} school={}
                //把老的值改为新的
                if (newVal != value) {
                    this.observer(newVal);//添加新值也触发 绑定get set方法
                    value = newVal //只有老的值和新的值不一样才修改
                    dep.notify();
                }
            }
        })
    }
}
//基类
class Compiler {
    constructor(el, vm) {
        //判断el属性 是不是一个元素 如果不是元素 那就获取他
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        //把当前节点中的元素 获取到 放到内存中
        this.vm = vm;
        let fragment = this.node2Fragment(this.el);
        // console.log(fragment)

        //把节点中的内容进行替换

        //编译模板 用数据编译
        this.compile(fragment);
        //把内容在塞到页面中 不然页面就没有节点/内容了
        this.el.appendChild(fragment);
    }
    //判断是否是指令 
    isDirective(attrName) {
        return attrName.startsWith('v-');
    }
    //编译元素 div ul span
    compileElement(node) {
        //那到当前元素的 属性
        let attributes = node.attributes;//属性 没有的话length就为0
        // console.log(attributes)//判断是否包含 v-model
        [...attributes].forEach(attr => {//type="text" v-mode='school.name'
            let { name, value: expr } = attr; //获取 name 属性名 值 对应data的属性
            //判断是不是指令
            if (this.isDirective(name)) { //v-model v-html v-bind
                let [, directive] = name.split('-');//那到v-后面的指令 v-on:click
                // console.log(node, 'element');
                let [directiveName, eventName] = directive.split(':')
                CompileUtil[directiveName](node, expr, this.vm, eventName)//this.vm $data
            }
        })
    }
    //编译空 text text内也可以是内容 大多都是 <div></div> 间隔这里就是text <div></div></div>
    compileText(node) { //判断当前文本节点的中内容是否包含 {{xxx}} {{aaaa}}
        let content = node.textContent;
        //去除不需要的
        if (/\{\{(.+?)\}\}/.test(content)) {
            //文本节点
            CompileUtil['text'](node, content, this.vm);//{{a}} {{b}}
            // console.log(content, "内容");
        }
    }
    //核心的编译方法
    compile(node) { //用来编译内存中的dom节点
        //去取data中的值 放到指定的位置 但是判断 带有{{}} v-的属性
        let childNodes = node.childNodes;//那到所有的子节点
        // console.log(childNodes);
        //childNodes只是个类数组，使用[...arr]转换为数组
        [...childNodes].forEach(child => {
            //判断是否是元素节点
            if (this.isElementNode(child)) { //如div ul 
                // console.log('element', child)
                this.compileElement(child);
                //如果是元素的话 需要吧自己穿进去 再去遍历自己的子节点 text
                this.compile(child);
            } else { //text 空节点
                // console.log('element', child)
                this.compileText(child);
            }
        })
    }

    //把节点移动到内存中
    node2Fragment(node) {
        //创建一个文档碎片
        let fragment = document.createDocumentFragment();
        let firstChild;
        //node 代表  id=app firstChild 是第一个节点 然后每次都会那到第一个节点 直到拿完
        while (firstChild = node.firstChild) {
            // console.log(firstChild)
            //appendChild具有移动性
            fragment.appendChild(firstChild);
        }
        return fragment;
    }
    isElementNode(node) { //封装一个函数 判断是不是元素节点
        return node.nodeType === 1;
    }
}
CompileUtil = {
    //根据表达式取到对应的数据
    getVal(vm, expr) { //vm.$data 'school.name';[school,name]
        return expr.split('.').reduce((data, current) => {
            // console.log(data, current)
            return data[current];
        }, vm.$data);
    },
    setValue(vm, expr, value) {//vm.$data 'school.name'='24242'
        return expr.split('.').reduce((data, current, index, arr) => {
            if (index == arr.length - 1) {
                return data[current] = value;
            }
            return data[current];
        }, vm.$data);
    },
    model(node, expr, vm) {//node是节点 expr是表达式 vm是当前实例
        //school.name vm.$data;
        let fn = this.updater['modelUpdater'];
        new Watcher(vm, expr, (newVal) => {//给输入框加一个观察者 如果稍后数据更新了会触发此方法,会拿心智 给输入框赋予值
            fn(node, newVal);//数据一更新就去调用fn方法
        });
        node.addEventListener('input', (e) => {
            let value = e.target.value;//获取用户输入的内容
            this.setValue(vm, expr, value);
        })
        // console.log(node, 'node', expr, "nodeexpr")
        let value = this.getVal(vm, expr);//返回值就是 需要的属性值
        fn(node, value);

    },
    html(node, expr, vm) {
        let fn = this.updater['htmlUpdater'];
        new Watcher(vm, expr, (newVal) => {
            fn(node, newVal);
        });
        let value = this.getVal(vm, expr);
        fn(node, value);
    },
    getContentValue(vm, expr) {
        //遍历表达式 将内容 重新替换成一个完整的内容 返还回去
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm, args[1])
        })
    },
    on(node, expr, vm, eventName) {
        node.addEventListener(eventName, (e) => {
            vm[expr].call(vm, e);//this.change
        })
    },
    text(node, expr, vm) { //expr=>{{a}} {{b}} {{c}} => a b c
        let fn = this.updater['textUpdater'];
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            //给表达式每个{{}} 都加上观察者
            new Watcher(vm, args[1], () => {
                fn(node, this.getContentValue(vm, expr));//返回了一个全的字符串
            })
            return this.getVal(vm, args[1]);
        });
        //最终内容
        fn(node, content);
    },
    updater: {
        //把数据插入到对应的节点中
        modelUpdater(node, value) {
            node.value = value;
        },
        htmlUpdater(node, value) {//xss攻击
            node.innerHTML = value;
        },
        //处理文本节点的
        textUpdater(node, value) {
            node.textContent = value;
        }
    }
}
class Vue {
    constructor(options) {
        //this.$el $data $options
        this.$el = options.el;
        this.$data = options.data;
        let computed = options.computed;
        let methods = options.methods;
        // 这个根元素 存在 编译模板
        if (this.$el) {
            //把数据 全部转化成Object.defineProperty来定义
            new Observer(this.$data);


            for (let key in computed) { //有依赖关系 数据变化
                Object.defineProperty(this.$data, key, {
                    get: () => {
                        return computed[key].call(this);
                    }
                })
            };
            for (let key in methods) {
                Object.defineProperty(this, key, {
                    get() {
                        return methods[key]
                    }
                })
            }
            //把数据获取操作 vm上的操作都代理到 vm.$data
            this.proxyVm(this.$data);
            console.log(this.$data);
            new Compiler(this.$el, this);
        }
    }
    proxyVm(data) {
        for (let key in data) {
            Object.defineProperty(this, key, {
                get: function () { //实现了可以通过vm取到对应的内容
                    return data[key]; //进行了转化方法
                },
                set(newVal) { //设置代理方法
                    data[key] = newVal;
                }
            })
        }
    }
}