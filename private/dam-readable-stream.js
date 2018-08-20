/**
 * Module dependencies
 */

var util = require('util');
var parley = require('parley');
var flaverr = require('flaverr');
var _ = require('@sailshq/lodash');
var Stream = require('stream');
var StringDecoder = require('string_decoder').StringDecoder;


/**
 * damReadableStream()
 *
 * Juice the contents of a readable stream with the specified "fromEncoding"
 * and return the resulting string (converted to "toEncoding", if specified).
 *
 * @param {Ref} readable
 * @param {String?} fromEncoding   (if unspecified, assumes it's coming as utf8)
 * @param {String?} toEncoding     (if unspecified, leaves incoming encoding alone - unless no "fromEncoding" was provided, in which case an error is thrown)
 * @param  {Error?} omen
 * @returns {String}   (the entire stream's contents, as a base64-encoded string)
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Example usage:
 * ```
 * var encodedReadmeContents = await require('./private/dam-readable-stream')(
 *   fs.createReadStream('./README.md'),
 *   'utf8',
 *   'base64'
 * );
 *
 * fs.writeFileSync('./experiment.base64', encodedReadmeContents);
 * ```
 *
 * And:
 * ```
 * var decodedReadmeContents = await require('./private/dam-readable-stream')(
 *   fs.createReadStream('./experiment.base64'),
 *   'base64',
 *   'utf8'
 * );
 *
 * console.log(decodedReadmeContents);
 * ```
 */
module.exports = function damReadableStream(readable, fromEncoding, toEncoding, omen) {
  return parley(
    (done)=>{
      var isProbablyUsableReadableStream = _.isObject(readable) && readable.readable === true && _.isFunction(readable.pipe) && (readable._readableState ? readable._readableState.objectMode !== true : true);
      if (!isProbablyUsableReadableStream) {
        return done(flaverr({
          name: 'UsageError',
          message: 'Invalid stream: Must be a usable Readable stream.  (For help: https://sailsjs.com/support)'
        }, omen));
      }//•

      if (!toEncoding && !fromEncoding) {
        return done(flaverr({
          name: 'UsageError',
          message: 'Since no "fromEncoding" was provided, a "toEncoding" must be provided -- but no "toEncoding" was passed in.  (For help: https://sailsjs.com/support)'
        }, omen));
      }//•

      // Note that we rely on parley's built-in spinlock here in order to ensure
      // that we're not accidentally re-triggering the callback.
      var transforming;
      var _onErrorForReadableAndTransformStreams = (err)=>{
        if (transforming && transforming.removeAllListeners) { transforming.removeAllListeners(); }
        readable.removeListener('error', _onErrorForReadableAndTransformStreams);
        return done(flaverr({
          message: 'Encountered an error when attempting to dam the contents of the provided Readable stream into a string value.  '+err.message,
          raw: err
        }, omen));
      };//ƒ (œ)
      readable.on('error', _onErrorForReadableAndTransformStreams);//œ

      var result = '';
      transforming = readable.pipe(StringStream(fromEncoding||'', toEncoding||''));
      transforming.on('error', _onErrorForReadableAndTransformStreams);//œ
      transforming.on('data', (stringChunk)=>{
        result += stringChunk;
      });//œ
      transforming.on('end', ()=>{
        transforming.removeAllListeners();
        readable.removeListener('error', _onErrorForReadableAndTransformStreams);
        done(undefined, result);
      });//œ
    },
    undefined,
    undefined,
    undefined,
    omen
  );
};//ƒ



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// The the rest of this file was pulled from "StringStream", a package written
// by @mhart and available under the MIT License.  (Thanks Michael!)
// Specifically, we're using v0.0.6:
// https://github.com/mhart/StringStream/blob/fee31c5c4a5efc7c7cc2fde4aee633dedefd6d67/stringstream.js
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/* eslint-disable */
function StringStream(from, to) {
  if (!(this instanceof StringStream)) return new StringStream(from, to)

  Stream.call(this)

  if (from == null) from = 'utf8'

  this.readable = this.writable = true
  this.paused = false
  this.toEncoding = (to == null ? from : to)
  this.fromEncoding = (to == null ? '' : from)
  this.decoder = new AlignedStringDecoder(this.toEncoding)
}
util.inherits(StringStream, Stream)

StringStream.prototype.write = function(data) {
  if (!this.writable) {
    var err = new Error('stream not writable')
    err.code = 'EPIPE'
    this.emit('error', err)
    return false
  }
  if (this.fromEncoding) {
    if (Buffer.isBuffer(data) || typeof data === 'number') data = data.toString()
    data = new Buffer(data, this.fromEncoding)//« FUTURE: deal with this (logs annoying warnings in node ≥10: https://github.com/mhart/StringStream/issues/11)
  }
  var string = this.decoder.write(data)
  if (string.length) this.emit('data', string)
  return !this.paused
}

StringStream.prototype.flush = function() {
  if (this.decoder.flush) {
    var string = this.decoder.flush()
    if (string.length) this.emit('data', string)
  }
}

StringStream.prototype.end = function() {
  if (!this.writable && !this.readable) return
  this.flush()
  this.emit('end')
  this.writable = this.readable = false
  this.destroy()
}

StringStream.prototype.destroy = function() {
  this.decoder = null
  this.writable = this.readable = false
  this.emit('close')
}

StringStream.prototype.pause = function() {
  this.paused = true
}

StringStream.prototype.resume = function () {
  if (this.paused) this.emit('drain')
  this.paused = false
}

function AlignedStringDecoder(encoding) {
  StringDecoder.call(this, encoding)

  switch (this.encoding) {
    case 'base64':
      this.write = alignedWrite
      this.alignedBuffer = new Buffer(3)//« FUTURE: deal with this (logs annoying warnings in node ≥10: https://github.com/mhart/StringStream/issues/11)
      this.alignedBytes = 0
      break
  }
}
util.inherits(AlignedStringDecoder, StringDecoder)

AlignedStringDecoder.prototype.flush = function() {
  if (!this.alignedBuffer || !this.alignedBytes) return ''
  var leftover = this.alignedBuffer.toString(this.encoding, 0, this.alignedBytes)
  this.alignedBytes = 0
  return leftover
}

function alignedWrite(buffer) {
  var rem = (this.alignedBytes + buffer.length) % this.alignedBuffer.length
  if (!rem && !this.alignedBytes) return buffer.toString(this.encoding)

  var returnBuffer = new Buffer(this.alignedBytes + buffer.length - rem)//« FUTURE: deal with this (logs annoying warnings in node ≥10: https://github.com/mhart/StringStream/issues/11)

  this.alignedBuffer.copy(returnBuffer, 0, 0, this.alignedBytes)
  buffer.copy(returnBuffer, this.alignedBytes, 0, buffer.length - rem)

  buffer.copy(this.alignedBuffer, 0, buffer.length - rem, buffer.length)
  this.alignedBytes = rem

  return returnBuffer.toString(this.encoding)
}
/* eslint-enable */
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// </ stringstream >
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
