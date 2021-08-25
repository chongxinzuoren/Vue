/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   * 初始化component, directive, filter
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        //没有第二个参数, 获取
        return this.options[type + 's'][id]
      } else {
        //有第二个参数就是注册
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          //Vue.extend, 基于defineition扩展子类, 
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        //Vue.options[type]={id: definition}
        //注册到全局的type上(component/directive/filter)
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
