/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

//通过 原型式继承 , 基于数组原型对象 创建新的对象
const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

//这7个方法会更改自身, 其他的concat等都是产生一个全新的数组, 不会对原来的进行更改
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
//对这7个方法进行重写
methodsToPatch.forEach(function (method) {
  // cache original method
  //获取 数组操作的 原生方法
  const original = arrayProto[method]
  //分别在arrayMethods 对象上定义 这 7个方法
  def(arrayMethods, method, function mutator (...args) {
    //先执行原生方法
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    //这三种 方法 会对数组元素 进行 新增 或者 删除
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    //如果有新增或删除, 则 对改变了的元素进行响应式处理
    if (inserted) ob.observeArray(inserted)
    // notify change
    //执行dep.notify 方法通知依赖更新
    ob.dep.notify()
    return result
  })
})
