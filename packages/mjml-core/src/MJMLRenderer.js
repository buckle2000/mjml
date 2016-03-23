import { EmptyMJMLError } from './Error'
import { html as beautify } from 'js-beautify'
import { insertColumnMediaQuery, fixLegacyAttrs, fixOutlookLayout, clean, removeCDATA } from './helpers/postRender'
import { minify } from 'html-minifier'
import { parseInstance } from './helpers/mjml'
import defaultContainer from './configs/defaultContainer'
import documentParser from './parsers/document'
import dom from './helpers/dom'
import fs from 'fs'
import getFontsImports from './helpers/getFontsImports'
import MJMLElementsCollection, { registerMJElement } from './MJMLElementsCollection'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import warning from 'warning'

const debug = require('debug')('mjml-engine/mjml2html')

export default class MJMLRenderer {

  constructor (content, options) {
    this.registerDotfile()

    this.content = content
    this.options = options

    if (typeof this.content === 'string') {
      this.parseDocument()
    }
  }

  registerDotfile () {
    try {
      const path = process.cwd()
      const MJMLElements = fs.readFileSync(`${path}/.mjml`).toString().split('\n')

      MJMLElements.map((file) => {
        if (!file) {
          return
        }

        try {
          const Component = require.main.require(file)
          registerMJElement(Component.default || Component)
        } catch(e) {
          warning(false, `.mjml file ${file} has an error : ${e}`)
        }
      })
    } catch(e) {
      warning(false, 'No .mjml found in path, please consider to add one')
    }
  }

  parseDocument () {
    debug('Start parsing document')
    this.content = documentParser(this.content)
    debug('Content parsed')
  }

  render () {
    if (!this.content) {
      throw new EmptyMJMLError(`.render: No MJML to render in options ${this.options.toString()}`)
    }

    const rootElemComponent = React.createElement(MJMLElementsCollection[this.content.tagName], { mjml: parseInstance(this.content) })

    debug('Render to static markup')
    const renderedMJML = ReactDOMServer.renderToStaticMarkup(rootElemComponent)

    debug('React rendering done. Continue with special overrides.')

    const MJMLDocument = defaultContainer({
      title: this.options.title,
      content: renderedMJML,
      fonts: getFontsImports({ content: renderedMJML })
    })

    return this._postRender(MJMLDocument)
  }

  _postRender (MJMLDocument) {
    let $ = dom.parseHTML(MJMLDocument)

    $ = insertColumnMediaQuery($)
    $ = fixLegacyAttrs($)
    $ = fixOutlookLayout($)
    $ = clean($)

    let finalMJMLDocument = dom.getHTML($)
    finalMJMLDocument     = removeCDATA(finalMJMLDocument)

    if (this.options.beautify && beautify) {
      finalMJMLDocument = beautify(finalMJMLDocument, {
        indent_size: 2,
        wrap_attributes_indent_size: 2
      })
    }

    if (this.options.minify && minify) {
      finalMJMLDocument = minify(finalMJMLDocument, {
        collapseWhitespace: true,
        removeEmptyAttributes: true,
        minifyCSS: true
      })
    }

    return finalMJMLDocument
  }

}
