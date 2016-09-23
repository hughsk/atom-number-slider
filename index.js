const meta = require('meta-keys')(window, true)
const Disposable = require('atom').Disposable
const findup = require('findup-element')

exports.activate = activate
exports.config = {
  enabledByDefault: {
    'type': 'boolean',
    'default': false,
    'title': 'Enable By Default',
    'description': 'Next time your editor starts up, number-slider will be enabled by default'
  }
}

function activate () {
  atom.workspace.getTextEditors().forEach(attach)
  atom.workspace.onDidAddTextEditor(function (d) {
    return attach(d.textEditor)
  })

  atom.commands.add('atom-workspace', 'number-slider:disable', setState(false))
  atom.commands.add('atom-workspace', 'number-slider:enable', setState(true))
  atom.commands.add('atom-workspace', 'number-slider:toggle', setState())

  setState(atom.config.get('number-slider.enabledByDefault'))()
}

var enabled = false
function setState (_enabled) {
  return function () {
    if (typeof _enabled === 'undefined') _enabled = !enabled
    if ((enabled = _enabled)) {
      document.body.classList.add('number-slider-enabled')
    } else {
      document.body.classList.remove('number-slider-enabled')
    }
  }
}

function attach (editor) {
  const view = atom.views.getView(editor)
  const subs = []

  var clientX = null
  var range = null
  var check = null
  var value = null

  view.shadowRoot.addEventListener('mousedown', mousedown, false)
  window.addEventListener('mousemove', mousemove, true)
  window.addEventListener('mouseup', clear, true)

  function mousedown (e) {
    if (!enabled) return

    const el = findup(e.target, function (el) {
      return el.classList && el.classList.contains('numeric')
    })
    // then check if there's a span inside that with a keyword - other - unit?

    if (!el) return

    const operator = (
      el.previousElementSibling &&
      el.previousElementSibling.innerHTML
    )
    const unitType = (
      el.children[0] &&
      el.children[0].innerHTML
    )

    range = editor.bufferRangeForScopeAtCursor('.numeric')
    if (!range) return
    if (operator === '-' || operator === '+') {
      range.start.column = Math.max(0, range.start.column - 1)
    }
    if (unitType === 'px' || unitType === '%'|| unitType === 'vw'|| unitType === 'vh'|| unitType === 'em'|| unitType === 'pt'|| unitType === 'ex'|| unitType === 'rem'|| unitType === 'pc'|| unitType === 'vmin'|| unitType === 'cm'|| unitType === 'mm'|| unitType === 'in') {
      range.end.column =  range.end.column - unitType.toString().length;
    }

    value = Number(editor.getTextInBufferRange(range))
    if (isNaN(value)) return

    check = editor.getBuffer().createCheckpoint()
    editor.setSelectedBufferRange(range)
    clientX = e.clientX

    document.body.classList.add('number-slider-down')
  }

  function mousemove (e) {
    if (!range) return
    const diff = e.clientX - clientX
    const nval = fixRounding(value + Math.round(diff / 2) * getAmplitude(value))

    range = editor.setTextInBufferRange(range, String(nval))
    editor.setSelectedBufferRange(range)

    e.stopPropagation()
    e.preventDefault()
    return false
  }

  function clear () {
    editor.getBuffer().groupChangesSinceCheckpoint(check)

    check = null
    range = null
    document.body.classList.remove('number-slider-down')
    document.body.style.cursor = null
  }

  subs.push(new Disposable(function () {
    view.shadowRoot.removeEventListener('mousedown', mousedown, false)
    window.removeEventListener('mousemove', mousemove, true)
    window.removeEventListener('mouseup', clear, true)
  }))

  subs.push(editor.onDidDestroy(function () {
    subs.forEach(function (sub) { return sub.dispose() })
    subs.length = 0
  }))
}

function getAmplitude (value) {
  if (meta.shift[0]) return 10
  if (meta.shift[1]) return 10
  if (meta.alt[0]) return 1
  if (meta.alt[1]) return 1
  return Math.min(1, Math.pow(10, Math.floor(Math.log10(value)))) || 1
}

function fixRounding (number) {
  return Math.round(number * 10000) / 10000
}
