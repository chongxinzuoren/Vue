1. 组件的初始化过程都做了什么?
    - 处理组件配置项

2. Vue响应式原理怎么实现的?
    - 

3. 异步更新(结合实例和手写实现想想, watcher dep 互相收集有点绕, computed,watch区别, nextTick原理)



状态变化  watcher.update触发虚拟DOM渲染流程(异步的)
vue有个队列queue, 每当需要渲染时, 将watcher推送到队列中, 在下一次事件循环再执行此watcher
```
异步流程:
状态改变, 触发watcher.update, 调用queueWatcher, watcher入队(会判重),
将flushSchedulerQueue 作为回调, 传入nextTick, 异步执行, 清空队列
```


变化的通知只发送到组件(组件级别粒度), 组件内2个状态更新, 组件的watcher会收到2次通知, 但不会渲染2次. 虚拟DOM 会对整个组件进行渲染, 等所有状态都修改完毕, 一次性将整个组件的DOM渲染到最新

vue 将收到的watcher实例添加到 队列中 缓存起来(会验重). 在下一次eventLoop中vue让 队列触发渲染流程, 并清空队列. 这样就可以保证多个状态更新只触发一次渲染

vue怎么保证多个状态更新只触发一次渲染?
多个状态改变, 触发多次组件的渲染watcher. vue会将收到的watcher实例添加到队列., 缓存起来, 并会验重. 并在下一次事件循环中 让队列触发渲染离婚曾, 并清空队列


nextTick: 将回调延迟到下次DOM更新周期之后(就是下次微任务执行时更新DOM)执行


//this.$nextTick获取更新后的DOM
```
this.msg="aaa"
this.$nextTick(function(){
    //DOM更新了
})
callbacks(DOM,fn)
```
```
this.$nextTick(function(){
    //DOM没更新
})
this.msg='aaa'
callbacks(fn,DOM)
//先使用nextTick注册回调fn, 然后修改数据, 则在微任务队列中先执行fn回调, 然后执行更新DOM的回调, 所以回调中得不到最新的DOM
```
```
//宏任务中注册回调
setTimeout(function(){
    //DOM更新了
},2000)
//修改数据, 向微任务中注册回调
this.msg="aaa"
callbacks(fn,DOM)   (微任务先执行) 
```
事件循环:
JS是单线程非异步, 在执行代码时只有一个主线程, 需要处理异步任务时, 主线程会将这个异步任务挂起(加入事件队列), 当主线程中的所有任务都执行完毕, 再去执行事件队列中的任务.
异步任务: 微任务, 宏任务
微任务队列中是否有任务存在, 如果存在, 依次执行微任务队列中`所有`事件对应的回调. 然后去宏任务队列取出 `一个` 事件, 把对应的回调加入当前执行栈, 当执行栈中所有任务都执行完, 又去检查微任务队列中是否有事件存在, 无限重复



keep-alive 缓存的是组件的vnode

建立父子关系时(initLifecycle), 会跳过keepAlive组件从而跳过生成真正的DOM节点

首次render被包裹组件时, 

当组件的keepAlive为true时, 不再进入$mount过程(beforeCreate, created, mounted)都不再执行

切换keep-alive时 会触发actived和deactived, patch时会触发invokeInsertHook, 或者函数会触发组件的insert钩子, 递归调用子组件的actived生命周期函数