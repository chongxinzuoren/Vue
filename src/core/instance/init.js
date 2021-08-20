/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    // a flag to avoid this being observed
    vm._isVue = true
    //合并组件配置项
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      //子组件: 性能优化, 减少原型链的动态查找
      initInternalComponent(vm, options)
    } else {
      //根组件: 选项合并, 将全局配置项 合并到根组件的局部配置上
      //组件选项合并, 发生在三个地方:
      //  1.Vue.component(CompName, Comp), 做了选项合并, 合并的 Vue内置的全局组件和用户自己注册的全局组件, 最终都会放到 全局的 components 选项中
      //  2.{components:{xxx}}, 局部注册, 执行编译器生成的render 函数时做了选项合并, 会合并到全局配置项到局部配置项上
      //  3.这里的根组件
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm

    //核心
    //组件关系属性的初始化, $parent $root $children等
    initLifecycle(vm)
    //自定义事件初始化
    //<comp @click="handleClick"></comp>
    //**组件上事件的监听其实是子组件自己在监听, 也就是说谁触发谁监听
    //this.$emit('click'), this.$on('click', function handleClick(){}) 
    initEvents(vm)
    //初始化插槽, 获取this.$slots, 定义this._c, 即createElement方法(h函数)
    initRender(vm)
    //执行beforeCreate生命周期函数
    callHook(vm, 'beforeCreate')
    //初始化inject选项
    initInjections(vm) // resolve injections before data/props
    //响应式原理的核心
    //初始化props, methods, computed, watch, data等选项
    initState(vm)
    //初始化provide选项
    //使用时, 会产生provide注入数据, inject去拿这个数据的想法
    //实际上, inject主动去祖代组件中查找provide是否有对应的key
    initProvide(vm) // resolve provide after data/props
    //执行created生命周期函数
    callHook(vm, 'created')

    //如果存在el选项, 自动执行$mount
    //没有el,需要写成 new Vue().$mount("#app")形式
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

//性能优化, 打平配置对象上的属性, 减少运行时原型链的查找
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  //基于 构造函数(Vue) 上的配置对象 创建vm.$options
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  //parent: 组件的根实例

  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  //有render函数, 将其 赋值到vm.$options
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

//从构造函数上解析配置项
export function resolveConstructorOptions (Ctor: Class<Component>) {
  //从实例构造函数上获取配置选项
  let options = Ctor.options

  //有super属性, 说明Ctor是Vue.extend构建的子类
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    //缓存
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      //找到更改的选项
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        //将更改的选项 和 extend选项合并
        //extendOptions:vue.extend合并生成的配置项
        extend(Ctor.extendOptions, modifiedOptions)
      }
      //将新的选项赋值给options
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
