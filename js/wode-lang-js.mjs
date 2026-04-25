export function makeJsIndents(CMLang) {
  return {
    'FunctionDeclaration ParamList': ctx => ctx.baseIndent,

    'Property ParamList': ctx => {
      let block

      block = ctx.node.parent?.getChild('Block')
      if (block) {
        let blockText

        blockText = ctx.state.doc.slice(block.from, block.to)
        if (/^\s*}/.test(blockText))
          return ctx.column(ctx.node.parent.from)
      }
      return ctx.column(ctx.node.parent.from) + ctx.unit
    },

    Block: ctx => {
      let parent

      parent = ctx.node.parent?.name

      if (parent == 'Property') {
        if (/^\s*}/.test(ctx.textAfter))
          return ctx.column(ctx.node.parent.from)
        return ctx.column(ctx.node.parent.from) + ctx.unit
      }

      if (parent == 'FunctionDeclaration') {
        let line, text, bracePos

        line = ctx.state.doc.lineAt(ctx.node.from)
        text = line.text
        bracePos = text.indexOf('{')
        if (bracePos > 0)
          return CMLang.delimitedIndent({ closing: '}', align: false })(ctx)
      }

      return CMLang.delimitedIndent({ closing: '}', align: true })(ctx)
    },

    'ExportDeclaration FunctionDeclaration': CMLang.flatIndent,

    SwitchBody: ctx => {
      let closed, isCase

      closed = /^\s*\}/.test(ctx.textAfter)
      isCase = /^\s*(case|default)\b/.test(ctx.textAfter)
      return ctx.baseIndent + (((closed || isCase) ? 0 : 1) * ctx.unit)
    }
  }
}
