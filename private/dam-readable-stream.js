/**
 * Module dependencies
 */

var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');
var B64 = require('b64');
var parley = require('parley');


/**
 * damReadableStream()
 *
 * Receive the complete contents of a readable stream, encode them as base64,
 * and return the resulting base64-encoded string.
 *
 * @param {Ref} readable
 * @param  {Error?} omen
 * @returns {String}   (the entire stream's contents, as a base64-encoded string)
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Example usage:
 * ```
 * var encodedReadmeContents = await require('./private/dam-readable-stream')(
 *   fs.createReadStream('./README.md')
 * );
 *
 * fs.writeFileSync('./experiment.base64', encodedReadmeContents);
 * ```
 */
module.exports = function damReadableStream(readable, omen) {
  return parley(
    (done)=>{
      var isProbablyUsableReadableStream = _.isObject(readable) && readable.readable === true && _.isFunction(readable.pipe) && (readable._readableState ? readable._readableState.objectMode !== true : true);
      if (!isProbablyUsableReadableStream) {
        return done(flaverr({
          name: 'UsageError',
          message: 'Invalid stream: Must be a usable Readable stream.  (For help: https://sailsjs.com/support)'
        }, omen));
      }//•

      // Encode bytes to base 64, streaming them in and building a data URI.
      var encoder = new B64.Encoder();
      var transformedStream = readable.pipe(encoder);
      transformedStream.on('error', function () { /* Just for safety. */ });//œ
      transformedStream.once('error', (err)=>{
        return done(flaverr({
          message: 'Encountered an error when attempting to dam the contents of the provided Readable stream into a string value (e.g. base64).  '+err.message,
          raw: err
        }, omen));
      });//œ
      // ^Note that we rely on parley's built-in spinlock here in order to ensure
      // that we're not accidentally re-triggering the callback.

      // Pool up the liquid dripping out of our base 64 string encoder
      // and send that accumulated string (`base64Str`) back as the result.
      var base64Str = '';
      transformedStream.on('data', function(bytes){
        base64Str += bytes.toString();
      });
      transformedStream.on('end', function () {
        return done(undefined, base64Str);
      });//_∏_
    },
    undefined,
    undefined,
    undefined,
    omen
  );
};//ƒ
