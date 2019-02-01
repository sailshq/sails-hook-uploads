/**
 * Module dependencies
 */

var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');
var B64 = require('b64');
var parley = require('parley');
var Strings = require('machinepack-strings');


/**
 * damReadableStream()
 *
 * Receive the complete contents of a readable stream, potentially encode them
 * as base64 (if base64 encoding is enabled) and then return the resulting
 * (potentially base64-encoded) string.
 *
 * @param {Ref} readable
 * @param {String} outputEncoding  (either "utf8" or "base64")
 * @param  {Error?} omen
 * @returns {String}   (the entire stream's contents, as a potentially-encoded string)
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Example usage:
 * ```
 * var encodedReadmeContents = await require('./private/dam-readable-stream')(
 *   fs.createReadStream('./README.md'),
 *   'base64'
 * );
 *
 * fs.writeFileSync('./experiment.base64', encodedReadmeContents);
 * ```
 */
module.exports = function damReadableStream(readable, outputEncoding, omen) {
  return parley(
    (done)=>{
      var isProbablyUsableReadableStream = _.isObject(readable) && readable.readable === true && _.isFunction(readable.pipe) && (readable._readableState ? readable._readableState.objectMode !== true : true);
      if (!isProbablyUsableReadableStream) {
        return done(flaverr({
          name: 'UsageError',
          message: 'Invalid stream: Must be a usable Readable stream.  (For help: https://sailsjs.com/support)',
          internalTrace: new Error()
        }, omen));
      }//•
      if (outputEncoding !== 'utf8' && outputEncoding !== 'base64') {
        return done(flaverr({
          name: 'UsageError',
          message: 'Invalid output encoding: If specified, must be either \'utf8\' or \'base64\'.  (For help: https://sailsjs.com/support)',
          internalTrace: new Error()
        }, omen));
      }//•

      // base64
      if (outputEncoding === 'base64') {
        // Encode bytes to base 64, streaming them in and building a data URI.
        let encoder = new B64.Encoder();
        let transformedStream = readable.pipe(encoder);
        transformedStream.on('error', ()=>{ /* Just for safety. */ });//œ
        transformedStream.once('error', (err)=>{
          return done(flaverr({
            message: 'Encountered an error when attempting to dam the contents of the provided Readable stream into a string value (e.g. base64).  '+err.message,
            internalTrace: new Error(),
            raw: err
          }, omen));
          // ^Note that we rely on parley's built-in spinlock here in order to ensure
          // that we're not accidentally re-triggering the callback.
        });//œ

        // Pool up the liquid dripping out of our base 64 string encoder
        // and send that accumulated string (`base64Str`) back as the result.
        let base64Str = '';
        transformedStream.on('data', function(bytes){
          base64Str += bytes.toString();
        });//œ
        transformedStream.on('end', function () {
          return done(undefined, base64Str);
        });//œ
      }
      // • utf8
      else {
        Strings.fromStream({
          sourceStream: readable
        }).exec((err, str)=>{
          if (err) { return done(err); }
          return done(undefined, str);
        });//_∏_
      }
    },
    undefined,
    undefined,
    undefined,
    omen
  );
};//ƒ
