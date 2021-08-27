/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  //this.$on
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

//平时使用都是 父组件.$emit, 子组件.$on, 不代表就是父组件监听, 子组件注册
//$emit, $on都是 对vm._events对象进行处理, 事件只在子组件上._events,  父组件没有, 所以不可能是父组件监听
//即谁注册, 谁监听

// vm._events
//Hook Event: Vue的自定义事件结合生命周期钩子, 实现的一种 从组件外部为组件注入额外生命周期方法的功能
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  //将所有的事件和回调放在vm._events对向上 
  //$on(key || [key1,key2...])
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      //数组, 遍历监听
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      // 一个事件可以设置多个响应函数
      // vm._events[type]=[fn,fn1...]
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      //<comp @hook:mounted="hookMounted">
      if (hookRE.test(event)) {
        //当前实例存在hook event
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  //对回调进行包装
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  /**
   * 移除vm._events 对象上的 指定事件的指定回调
   *  1. 没有提供参数, vm._events={}
   *  2. 提供第一个参数, vm._events[event]=null
   *  3. 提供了两个参数, 移除指定回调函数
   * 
   * 总结: 操作通过$on 设置的vm._events 对象
   * @param {*}} event 
   * @param {*} fn 
   * @returns 
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    //没有参数, 移除所有 event
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        //递归调用
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    //对应 event 的所有 回调
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    //没有指定event的回调函数, 移除所有回调
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      //移除指定事件的指定的回调函数
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    //指定事件的所有回调
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      //this.$emit("key", arg1, arg2...)
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
