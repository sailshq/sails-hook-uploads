/**
 * Module dependencies
 */

var util = require('util');
var _ = require('@sailshq/lodash');
var parley = require('parley');
var flaverr = require('flaverr');
var Stream = require('stream');
var StringDecoder = require('string_decoder').StringDecoder;


/**
 * damReadableStream()
 *
 * @param {Ref} readable
 * @param {String?} encoding   (if unspecified, defaults to base64)
 * @param  {Error?} omen
 * @returns {String}   (the entire stream's contents, as a base64-encoded string)
 */
module.exports = function damReadableStream(readable, encoding, omen) {
  return parley(
    (done)=>{
      if (!readable) {
        return done(flaverr({
          name: 'UsageError',
          code: 'E_NOT_A_READABLE_STREAM',
          message: 'Invalid stream: Must be a Readable stream.  (For help: https://sailsjs.com/support)'
        }, omen));
      }//•

      if (encoding === undefined) {
        encoding = 'base64';
      }

      // Note that we rely on parley's built-in spinlock here in order to ensure
      // that we're not accidentally re-triggering the callback.
      var transforming;
      var _onErrorForReadableAndTransformStreams = function(err){
        if (transforming && transforming.removeAllListeners) { transforming.removeAllListeners(); }
        readable.removeListener('error', _onErrorForReadableAndTransformStreams);
        return done(err);
      };//ƒ (œ)
      readable.on('error', _onErrorForReadableAndTransformStreams);//œ

      var result;
      transforming = readable.pipe(StringStream('base64'));
      transforming.on('error', _onErrorForReadableAndTransformStreams);//œ
      transforming.on('data', (stringChunk)=>{
        result += stringChunk;
      });//œ
      transforming.on('end', function() {
        transforming.removeAllListeners();
        readable.removeListener('error', _onErrorForReadableAndTransformStreams);
        done(undefined, result);
      });//œ

      // OLD:
      // // We use a self-calling function below in order to impose "finally" logic
      // // that cleans up any lingering event listeners on streams, just to be safe.
      // var transforming;
      // ((proceed)=>{
      //   function _onErrorForReadable(err){ return proceed(err); }//ƒ (œ)

      //   // Note that we rely on parley's built-in spinlock here in order to ensure
      //   // that we're not accidentally re-triggering the callback.
      //   readable.on('error', (err)=>{
      //     if (transforming && transforming.removeAllListeners) {
      //       transforming.removeAllListeners();
      //     }
      //     done(err);
      //   });//œ

      //   transforming = readable.pipe(StringStream('base64'));

      //   var result;
      //   transforming.on('data', (stringChunk)=>{
      //     result += stringChunk;
      //   });//œ
      //   transforming.on('error', (err)=>{
      //     if (transforming && transforming.removeAllListeners) {
      //       transforming.removeAllListeners();
      //     }
      //     done(err);
      //   });//œ
      //   transforming.on('end', function() {
      //     transforming.removeAllListeners();
      //     done(undefined, result);
      //   });//œ
      // })((err, result)=>{
      //   if (transforming && transforming.removeAllListeners) {
      //     transforming.removeAllListeners();
      //   }
      //   readable.removeListener('error', _onErrorForReadable);
      //   if (err) { return done(err); }
      //   return done(undefined, result);
      // });//_∏_ (†)
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
    data = new Buffer(data, this.fromEncoding)
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
      this.alignedBuffer = new Buffer(3)
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

  var returnBuffer = new Buffer(this.alignedBytes + buffer.length - rem)

  this.alignedBuffer.copy(returnBuffer, 0, 0, this.alignedBytes)
  buffer.copy(returnBuffer, this.alignedBytes, 0, buffer.length - rem)

  buffer.copy(this.alignedBuffer, 0, buffer.length - rem, buffer.length)
  this.alignedBytes = rem

  return returnBuffer.toString(this.encoding)
}
/* eslint-enable */
