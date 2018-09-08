/**
 * Module dependencies
 */

var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');
var MimeTypes = require('mime-types');


/**
 * sniffReadableStream()
 *
 * Examine the given readable stream and attempt to ascertain an appropriate
 * MIME type for it, as well as the original filename (if available).
 *
 * @param {Ref} readable
 * @param  {Error?} omen
 * @returns {Dictionary}
 *          @property {String} name    (original file name - or empty string if not sniffable)
 *          @property {String} type    (MIME type - or empty string if not sniffable)
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Example usage:
 * ```
 * var originalFileInfo = require('./private/sniff-readable-stream')(
 *   fs.createReadStream('./README.md')
 * );
 *
 * console.log('Original file name:', originalFileInfo.name);
 * console.log('Original MIME type:', originalFileInfo.type);
 * ```
 */
module.exports = function sniffReadableStream(readable, omen) {
  var isProbablyUsableReadableStream = _.isObject(readable) && readable.readable === true && _.isFunction(readable.pipe) && (readable._readableState ? readable._readableState.objectMode !== true : true);
  if (!isProbablyUsableReadableStream) {
    throw flaverr({
      name: 'UsageError',
      message: 'Invalid stream: Must be a usable Readable stream.  (For help: https://sailsjs.com/support)'
    }, omen);
  }//•

  // Sniff file name, if available.
  var sniffedOriginalFileName;
  if (_.isString(readable.filename) && readable.filename !== '') {
    sniffedOriginalFileName = readable.filename;
  } else if (_.isString(readable.name) && readable.name !== '') {
    sniffedOriginalFileName = readable.name;
  }

  // We attempt to sniff the MIME `type` however we can get it, either
  // from a property of the original Readable, if available, or based on extname
  // of the original filename, if that's available.  There's only a few different
  // common kinds of streams from Node core libraries and other popular npm
  // packages like `request`, so this kind of sniffing is actually pretty
  // effective.  (Also note we don't default to application/octet-stream -- that
  // way it's still easy to tell if the snifffig failed.)
  var sniffedMimeType;
  if (
    _.isObject(readable.response) &&
    _.isObject(readable.response.headers) &&
    _.isString(readable.response.headers['content-type']) &&
    readable.response.headers['content-type'] !== ''
  ) {
    sniffedMimeType = readable.response.headers['content-type'];
  } else if (sniffedOriginalFileName && MimeTypes.lookup(sniffedOriginalFileName)) {
    sniffedMimeType = MimeTypes.lookup(sniffedOriginalFileName);
  }

  return {
    name: sniffedOriginalFileName || '',
    type: sniffedMimeType || ''
  };

};
