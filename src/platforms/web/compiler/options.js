/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  //负责编译class, model, style, v-module(input)
  modules,
  directives,
  //pre 标签
  isPreTag,
  //是否为一元标签(自闭合标签)
  isUnaryTag,
  //必须使用 属性 的标签
  mustUseProp,
  //可以只有 开始标签 的标签
  canBeLeftOpenTag,
  //保留标签
  isReservedTag,
  //命名空间
  getTagNamespace,
  //静态key
  staticKeys: genStaticKeys(modules)
}
