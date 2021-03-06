/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/*
this.$watch(()=>this.name+this.age,()=>{})
expOrFn是一个函数, 需要收集多个Dep

收集依赖流程
observe->
walk->
defineReactive-> get->
dep.depend->
watcher.addDep(new Dep())->
watcher.deps.push(dep)->
dep.addSub(new Watcher())->
dep.subs.push(watcher)


更新流程
set->
dep.notify->
subs[i].update->
watcher.run || queueWatcher(this)->
watcher.get() || watcher.cb->
watcher.getter()->

*/
/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    //$watch的第一个参数
    expOrFn: string | Function,
    //实例化watcher时的第二个参数, getter函数
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      //渲染watcher
      vm._watcher = this
    }
    //添加的所有watcher, 用于teardown
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    //记录当前订阅了哪些Dep
    this.deps = []
    this.newDeps = []
    //记录当前Watcher已经订阅了该Dep
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      //传递的是字符串key, 可以通过this.key
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    //通过传入的lazy, 延迟watch.get方法的执行
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 触发 updateComponent 的执行, 进行组件更新, 进入patch阶段,
   * 更新组件时先执行 render 生成 VNode, 期间触发读取操作, 进行依赖收集
   */
  get () {
    // 什么情况下才会执行 更新?
    // 对新值进行依赖收集
    // 读取时收集依赖
    //this就是watcher实例, 即Dep.target是watcher实例
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      //执行实例化 watcher 时 传递进来的第二个参数
      // 有可能是一个函数, 比如 实例化渲染 watcher 时传递的 updateComponent函数
      // 用户 watcher, 可能传递的一个key, 也可能是读取 this.key 的函数
      // 触发读取操作, 被 getter 拦截, 进行依赖收集
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 将dep放到Watcher中
   * 用来记录自己订阅过哪些 Dep
   * 为了将自己从依赖列表中删除掉
   */
  addDep (dep: Dep) {
    const id = dep.id
    //如果dep没有被收集过
    if (!this.newDepIds.has(id)) {
      //set, 自动去重
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        //将watcher实例自己放到dep中, 双向收集
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      //懒执行, 如computed
      //在组件更新后, 当响应式数据再次被更新时, 执行 computed getter
      //重新执行computed 回调函数, 计算新值, 然后缓存到watcher.value
      this.dirty = true
    } else if (this.sync) {
      //同步执行
      //this.$watche 或者 watch 传递一个{sync:true}配置
      this.run()
    } else {
      //将当前watcher 放入 watcher 队列
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      //重新求值
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        // 旧值
        const oldValue = this.value
        this.value = value
        if (this.user) {
          //用户watcher
          //watch:{cc(newVal, oldVal){}}
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        //通知 订阅的Dep, 从依赖列表中移除
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
