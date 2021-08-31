#### vnode 的类型

- 注释节点
  ```
  {
    text:"",
    isComment:true
  }
  ```
- 文本节点
  ```
  {
    text:""
  }
  ```
- 元素节点
  ```
  {
    children:[vNode,vNode],
    context:{}, //当前的组件实例
    data:{},//节点上的数据attrs, style, class
    tag:"p"
  }
  ```
- 组件节点
  ```
    {
      componentInstance:{},//组件的选项参数, 包含propsData, tag, children等信息
      compoentOptions:{},//组件的实例
      context:{},
      data:{},
      tag:"
    }
  ```
- 函数式组件
  ```
    {
      functionalContext:{},
      functionOptions:{},
      context:{},
      data:{},
      tag:"div"  
    }
  ```
- 克隆节点


不同的 vNode 只是属性不同
每个组件都是一个Vue实例