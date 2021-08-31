/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  //执行 baseCompile 之前的所有事, 只有一个目的, 构造最终的编译配置
  //核心
  //解析, code(html模板) ---> ast
  const ast = parse(template.trim(), options)
  //优化, 标记静态节点和静态根节点
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  //ast ---> code(render函数的字符串)
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
