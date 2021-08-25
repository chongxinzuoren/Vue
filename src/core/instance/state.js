/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

//将key代理到vue实例上
//访问this.key 实际访问的是this.sourceKey.key
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    //this._props.key
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  //拦截 对 this.key 的访问
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  //对props做响应式处理
  //代理props 配置上的 key 到 vue 实例, 支持this.propKey的方式访问
  if (opts.props) initProps(vm, opts.props)
  //判重处理, methods对象中定义的属性不能和props对象中的属性重复
  //优先级props>methods
  //将methods中的配置赋值到vue实例上, 支持通过this.methodKey访问方法
  if (opts.methods) initMethods(vm, opts.methods)
  //判重处理, data 中的属性不能和 props 以及 methods中的属性重复
  //代理, 将 data 中的属性代理到vue实例, 支持通过this.dataKey的方式访问
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // computed 时通过Watcher来实现的, 对每个 computedKey 实例化一个 Watcher(默认lazy执行)
  //将 computedKey 代理到vue 实例上, 支持this.computedKey 的方式访问computed.key
  //理解computed 缓存实现的原理
  if (opts.computed) initComputed(vm, opts.computed)
  //实例化一个Watcher实例, 返回一个unwatch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
  //computed 和 watch 有什么区别?
  //1. computed 默认lazy执行, 且不可更改, 但是watch 可配置
  //2. 使用场景不同
}

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      //对 props 数据做响应式处理
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      //代理 this._props, 
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  //保证后续处理的data是一个对象
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  //判重处理, data 中的属性不能和 props 以及 methods 中的属性重复
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      //代理 data 中的属性 到vue实例上, 支持通过 this.key 的方式访问
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  //响应式处理
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  //遍历 computed 对象
  //{
  //  computed: {
  //    msg(){},
  //    msg1:{set(){},get(){}}
  //  }
  //}
  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      //实例化一个 Watcher, 所以computed 其实就是通过watcher 实现的
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  //将computed 配置项中的key 代理到vue 实例上, 支持通过this.computedKey的方式去访问
  //只有模板中引用了计算属性, 才会调用get, 执行计算属性
  
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

//默认computed不会执行(dirty, lazy watch)
function createComputedGetter (key) {
  return function computedGetter () {
    //拿到watcher
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      //执行 watcher.evaluate 方法
      //执行computed.key 的值(函数) 得到函数的执行结果, 赋值给watcher.value
      //将watcher.dirty 置为false
      //computed 和 methods 有什么区别
      // computed 计算结果会缓存
      // 一次渲染过程中, 只会 执行一次computed 函数, 后续的访问就不会再次执行, 直到下一次更新之后, 才会再次执行 
      if (watcher.dirty) {
        //这里一次渲染过程就为false, 只有 Wacher.update 才会变为true
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  //判断重复
  //methods中的key 不能和 props 中的key重复
  //优先级props > methods 
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    //将 methods中的所有方法赋值到vue实例上
    //this.methodKey 访问定义的方法
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)

    //vue为什么不对methods也进行proxy?
    //方法只会get, 不会set, 不用proxy
  }
}

function initWatch (vm: Component, watch: Object) {
  //便利watch 配置项
  for (const key in watch) {
    const handler = watch[key]
    //可以时回调数组形式 [()=>{},()=>{}], 会被逐一调用
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  //是对象
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  //字符串, 表示的是一个 methods 方法, 直接通过this.methodskey的方式拿到这个函数
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  //对于新增的属性, vue无法检测, 需要使用$set
  Vue.prototype.$set = set
  Vue.prototype.$delete = del
  //this.$watch(expOrFn, {} || ()=>{})
  //如果使用这种方式调用, 最后需要unwatch注销
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    //处理回调函数是对象, 保证后续处理cb肯定是一个函数
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    //标记, 这是一个用户watcher
    options.user = true
    //实例化Watcher
    const watcher = new Watcher(vm, expOrFn, cb, options)
    //immediate: 立即执行 回调函数
    //立即以 expOrFn 的当前值触发回调
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    // 返回一个 unwatch
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
