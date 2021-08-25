/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  //Vue.use(plugin)
  //总结: 本质就是在执行插件暴露的install方法
  Vue.use = function (plugin: Function | Object) {
    //缓存, 防止重复注册同一个组件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 添加install第一个参数为this(Vue实例)
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      //plugin是对象, 存在install方法
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      //plugin是函数
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
