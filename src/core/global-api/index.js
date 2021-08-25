/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
//就是keep-alive
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'
import components from '../components/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  // 全局默认的配置
  const configDef = {}
  configDef.get = () => config
  //不允许直接覆盖(Vue.config={} ❌)
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  //向外暴露一些工具方法
  Vue.util = {
    //日志
    warn,
    //浅拷贝 A对象-->B对象
    extend,
    //合并选项
    mergeOptions,
    //双向绑定
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  //Vue.options={component, directive, filter}
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 将Vue构造函数赋值
  Vue.options._base = Vue

  //将keep-alive组件放到Vue.options.components 对象中
  extend(Vue.options.components, builtInComponents)

  //初始化Vue.use
  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  //Vue.component/directive/filter
  initAssetRegisters(Vue)
}
