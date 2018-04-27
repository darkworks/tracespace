// runs pcb-stackup-core on the board fixtures
'use strict'

const runParallel = require('run-parallel')
const runWaterfall = require('run-waterfall')

const gerberToSvg = require('gerber-to-svg')
const whatsThatGerber = require('whats-that-gerber')

const debug = require('debug')('tracespace/pcb-stackup-core/integration')
const pcbStackupCore = require('..')

module.exports = function getResults (boards, done) {
  debug(`Rendering stackups for ${boards.length} boards`)

  runParallel(boards.map(board => next => renderStackup(board, next)), done)
}

function renderStackup (board, done) {
  debug(`Render started for ${board.name}`)

  const options = Object.assign(
    {
      id: `__${board.name}`,
      maskWithOutline: true
    },
    board.options
  )

  runWaterfall(
    [
      next =>
        runParallel(
          board.layers.map(layer => next => renderLayer(layer, next)),
          next
        ),
      (layers, next) => {
        try {
          const stackup = pcbStackupCore(layers, options)
          debug(`Render finished for ${board.name}`)

          next(null, Object.assign({stackup}, board))
        } catch (error) {
          next(error)
        }
      }
    ],
    done
  )
}

function renderLayer (layer, done) {
  const {filename, name, type: realType} = layer
  const type = whatsThatGerber(name)
  const options = Object.assign(
    {
      id: `__${filename}`,
      plotAsOutline: type === 'out'
    },
    layer.options
  )

  if (type !== realType) {
    return done(
      new Error(`${name} is type ${realType}, but ${type} was inferred`)
    )
  }

  const converter = gerberToSvg(layer.contents, options, error => {
    if (error) return done(error)

    done(null, {converter, type})
  })
}