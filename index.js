/**
 * Module dependencies
 */

var util = require('util');
var path = require('path');
var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');
var parley = require('parley');
var Strings = require('machinepack-strings');
var defaultFilesystemAdapter = require('skipper-disk');
var verifyUpstream = require('./private/verify-upstream');
var damReadableStream = require('./private/dam-readable-stream');
var sniffReadableStream = require('./private/sniff-readable-stream');


/**
 * uploads hook
 *
 * @description :: A hook definition.  Extends Sails by adding shadow routes, implicit actions, and/or initialization logic.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

module.exports = function defineUploadsHook(sails) {

  return {

    defaults: {
      uploads: {
        adapter: undefined,
        dirpath: '.tmp/uploads',
      }
    },

    configure: function(){
      if (process.env.NODE_ENV === 'production' && !sails.config.uploads.adapter) {
        if (sails.config.environment === 'staging') {
          sails.log.warn('No filesystem adapter was configured for use with sails-hook-uploads.');
          sails.log.warn('Using default, built-in filesystem adapter for uploads...');
          sails.log.warn('(But remember: In production, `sails.config.uploads.adapter` must be set explicitly!)');
        } else {
          throw new Error('In production, `sails.config.uploads.adapter` must be set explicitly!');
        }
      }
    },

    /**
     * Runs when a Sails app loads/lifts.
     *
     * @param {Function} done
     */
    initialize: function (done) {

      sails.log.verbose('Initializing `uploads` hook (from `sails-hook-uploads`)');

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // FUTURE: Add support for generic sails.uploadAny() functionality:
      // /**
      //  * .uploadAny()
      //  *
      //  * Upload all incoming files from any upstream.
      //  *
      //  * @param {Ref} req
      //  * @param {Dictionary?} moreOptions
      //  * @param {Function?} _explicitCbMaybe
      //  * @param {Error?} omen
      //  *
      //  * @returns {Deferred}
      //  *          @returns {Array}
      //  *              @of {Dictionary}
      //  *                  @property {String} fd
      //  *                  @property {String} type
      //  *                  @property {String} field
      //  */
      // sails.uploadAny = function (req, moreOptions, _explicitCbMaybe, omen){//eslint-disable-line no-unused-vars

      //   throw new Error('Not implemented yet');
      //   // var explicitCb = _.isFunction(moreOptions) ? moreOptions : _explicitCbMaybe;

      //   // omen = omen || flaverr.omen(sails.uploadAny);
      //   // //^In development and when debugging, we use an omen for better stack traces.

      //   // // FUTURE: get all upstreams somehow
      //   // // FUTURE: then drain them all
      //   // // return parley(
      //   // //   function (done){
      //   // //     verifyUpstream(upstream, omen);
      //   // //     var skipperOpts = _.extend({}, sails.config.uploads, moreOptions);
      //   // //     upstream.upload(skipperOpts, done);//_∏_
      //   // //   },
      //   // //   explicitCb||undefined,
      //   // //   undefined,
      //   // //   undefined,
      //   // //   omen
      //   // // );
      // };
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      /**
       * .upload()
       *
       * Upload all of the incoming files in the specified upstream.
       *
       * @param {Ref} upstream
       * @param {Dictionary?} moreOptions
       * @param {Function?} _explicitCbMaybe
       *
       * @returns {Deferred}
       *          @returns {Array}
       *              @of {Dictionary}
       *                  @property {String} fd
       *                  @property {String} type
       */
      if (sails.upload !== undefined) { throw new Error('Cannot attach `sails.upload()` because, for some reason, it already exists!'); }
      sails.upload = function (upstream, moreOptions, _explicitCbMaybe){

        var explicitCb = _.isFunction(moreOptions) ? moreOptions : _explicitCbMaybe;

        var omen = flaverr.omen(sails.upload);
        //^In development and when debugging, we use an omen for better stack traces.

        return parley(
          function (done){
            verifyUpstream(upstream, omen);
            var skipperOpts = _.extend({}, sails.config.uploads, moreOptions);
            upstream.upload(skipperOpts, function (err, result) {
              if (err) { return done(err); }
              if (!_.isArray(result)) {
                sails.log.warn('For some reason, Skipper did not return an array for this upstream.  If you have a sec, please let us know you saw this message by following the instructions at https://sailsjs.com/bugs.  Thank you!');
                result = [];
              }
              // For compatibility: try to determine filename for each item
              // within `result` and ensure it is attached as `name` if known,
              // otherwise empty string.
              for (let file of result) {
                if (file.name === undefined) {
                  file.name = file.filename || '';
                }
              }//∞
              return done(undefined, result);
            });//_∏_
          },
          explicitCb||undefined,
          undefined,
          undefined,
          omen
        );
      };

      /**
       * .uploadOne()
       *
       * @param {Ref} upstreamOrFileStream
       * @param {Dictionary?} moreOptions
       * @param {Function?} _explicitCbMaybe
       *
       * @returns {Deferred}
       *          @returns {Dictionary}
       *              @property {String} fd
       *              @property {String} type
       */
      if (sails.uploadOne !== undefined) { throw new Error('Cannot attach `sails.uploadOne()` because, for some reason, it already exists!'); }
      sails.uploadOne = function (upstreamOrFileStream, moreOptions, _explicitCbMaybe){

        var explicitCb = _.isFunction(moreOptions) ? moreOptions : _explicitCbMaybe;

        var omen = process.env.NODE_ENV !== 'production' || process.env.DEBUG ? flaverr({}, new Error('omen'), sails.uploadOne) : undefined;
        //^In development and when debugging, we use an omen for better stack traces.

        return parley(
          function (done){

            var skipperOpts = _.extend({}, sails.config.uploads, moreOptions);

            if (skipperOpts.filename !== undefined) {
              return done(new Error('The `filename` option is not supported.  Please use `saveAs()` or `extname`.'));
            }

            // Verify `extname`, if specified.
            if (skipperOpts.extname !== undefined) {
              if (!_.isString(skipperOpts.extname) || !skipperOpts.extname) {
                return done(new Error('Invalid `extname`: If specified, must be a non-empty string.'));
              }//•
            }

            // Verify `dirname`, if specified.
            if (skipperOpts.dirname !== undefined) {
              if (!_.isString(skipperOpts.dirname) || !skipperOpts.dirname) {
                return done(new Error('Invalid `dirname`: If specified, must be a non-empty string.'));
              }//•
            }

            // Detect if "upstreamOrFileStream" is an upstream or just an incoming binary Readable.
            try {
              verifyUpstream(upstreamOrFileStream, omen);
            } catch (err) {
              switch (err.code) {
                case 'E_NOT_AN_UPSTREAM':

                  var isProbablyUsableReadableStream = _.isObject(upstreamOrFileStream) && upstreamOrFileStream.readable === true && _.isFunction(upstreamOrFileStream.pipe) && (upstreamOrFileStream._readableState ? upstreamOrFileStream._readableState.objectMode !== true : true);
                  if (!isProbablyUsableReadableStream) {
                    return done(new Error(
                      'Invalid stream: Any chance you forgot to include `files: [\'nameOfSomeInput\']` at the top level of your action?  Otherwise, make sure you are using a valid incoming stream: either an upstream or a usable Node.js binary Readable stream (e.g. from `sails.helpers.http.getStream()`, `fs.createReadStream(…)`, or a PassThrough stream, or `require(\'request\').get(…)`)'
                    ));
                  }//•

                  // If this is probably a usable readable stream, try to use it.
                  // But first attach the `skipperFd` property. (Otherwise, the adapter will choke.)
                  // And to do that, we need to determine the unique file descriptor.
                  // (This represents the location where file should be written in the remote fs.)
                  //
                  // > Here we mirror the normal behavior of saveAs from Skipper:
                  // > • https://github.com/balderdashy/skipper/tree/aee21055fcada07527ef3f5a18dd50c4b56ee696#options
                  // > • https://github.com/balderdashy/skipper/blob/7a24f0c88942cef56224204450fa7c6b2cc414c4/standalone/Upstream/build-renamer-stream.js#L24-L59
                  ((proceed)=>{
                    // Use the `saveAs` string verbatim
                    if (_.isString(skipperOpts.saveAs)) {
                      return proceed(undefined, skipperOpts.saveAs);
                    }
                    // Run the `saveAs` fn to determine the basename
                    else if (_.isFunction(skipperOpts.saveAs)) {
                      skipperOpts.saveAs(upstreamOrFileStream, function (err, fdFromUserland){
                        if (err) { return proceed(err); }

                        if (!_.isString(fdFromUserland)) {
                          return proceed(new Error('The `saveAs` function triggered its callback, but did not send back a valid string as the 2nd argument.  Instead, got: '+util.inspect(fdFromUserland, {depth:null})+''));
                        }

                        return proceed(undefined, fdFromUserland);
                      });//</saveAs>
                    }
                    // The default `saveAs` implements a unique fd by combining:
                    //  • a generated UUID  (like "4d5f444-38b4-4dc3-b9c3-74cb7fbbc932")
                    //  • the file's original extension (like ".jpg") if `extname` option was provided
                    //    (or otherwise falling back to ".upload")
                    else if (skipperOpts.saveAs === undefined) {
                      return proceed(undefined, Strings.uuid().now()+(skipperOpts.extname?skipperOpts.extname:'.upload'));
                    }
                    else {
                      throw new Error('Invalid `saveAs`:  If specified, must be a string or a function.');
                    }
                  })((err, basename)=>{
                    if (err) { return done(err); }

                    if (_.isString(skipperOpts.dirname)) {
                      upstreamOrFileStream.skipperFd = path.join(skipperOpts.dirname, basename);
                    }
                    else {
                      upstreamOrFileStream.skipperFd = basename;
                    }

                    // For compatibility, in addition to `skipperFd` write `fd`, but only if a defined
                    // `fd` property doesn't already exist.
                    // (This had to change because Node core started using the `fd` property on file
                    // streams differently itself.)
                    if (upstreamOrFileStream.fd === undefined) {
                      upstreamOrFileStream.fd = upstreamOrFileStream.skipperFd;
                    }

                    // Also set `filename`, for advisory purposes.
                    // (can affect logs in adapter)
                    upstreamOrFileStream.filename = (
                      upstreamOrFileStream.filename ||
                      upstreamOrFileStream.name ||
                      upstreamOrFileStream.skipperFd
                    );

                    // Now use a little pocket function to load up the appropriate adapter.
                    var adapter = (()=>{
                      let _adapter = skipperOpts.adapter || defaultFilesystemAdapter;
                      if (_.isFunction(_adapter)) {
                        _adapter = _adapter(skipperOpts);
                      }
                      return _adapter;
                    })();

                    // Note that these listeners are handled with inline functions
                    // only because there is no other way to unbind _only_ them
                    // (i.e. otherwise we risk unbinding other important listeners
                    // that are in use by the receiver stream's internal implementation.)
                    //
                    // Still, to mitigate the complexity of this code, we use a self-calling
                    // function to wrap it all up.
                    ((proceed)=>{
                      var receiver = adapter.receive(skipperOpts);

                      var onReceiverError = (err)=>{
                        receiver.removeListener('error', onReceiverError);
                        receiver.removeListener('finish', onReceiverFinish);//eslint-disable-line no-use-before-define
                        return proceed(err);
                      };//ƒ
                      receiver.once('error', onReceiverError);

                      var onReceiverFinish = ()=>{
                        receiver.removeListener('error', onReceiverError);
                        receiver.removeListener('finish', onReceiverFinish);
                        return proceed();
                      };//ƒ
                      receiver.once('finish', onReceiverFinish);

                      receiver.write(upstreamOrFileStream);
                      receiver.end();

                    })((err)=>{
                      if (err) { return done(err); }

                      let sniffed;
                      try {
                        sniffed = sniffReadableStream(upstreamOrFileStream, omen);
                      } catch (err) { return done(err); }

                      return done(undefined, {
                        fd: upstreamOrFileStream.skipperFd,
                        name: sniffed.name,
                        type: sniffed.type,
                      });
                    });//_∏_  (†)
                  });//_∏_  (†)
                  return;//•

                default:
                  throw err;
              }//•
            }

            // Otherwise IWMIH, this is an upstream:
            upstreamOrFileStream.upload(skipperOpts, (err, uploadedFiles)=>{
              if (err) { return done(err); }
              if (uploadedFiles.length > 1) {
                return done(flaverr({
                  code: 'E_TOO_MANY_FILES',
                  message: 'Too many files!  .uploadOne() expected the upstream to contain exactly one file upload, but instead it contained '+uploadedFiles.length+'.'
                }, omen));
                // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                // FUTURE: Support automatically cleaning up after these files.
                // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              }//•
              // For compatibility: try to determine filename and ensure it is
              // attached as `name` if known, otherwise empty string.
              if (uploadedFiles[0] && uploadedFiles[0].name === undefined) {
                uploadedFiles[0].name = uploadedFiles[0].filename || '';
              }
              return done(undefined, uploadedFiles[0]);
            });//_∏_

          },
          explicitCb||undefined,
          undefined,
          undefined,
          omen
        );
      };


      /**
       * .download()
       * .downloadOne()
       *
       * (just aliases to help avoid typos/confusion)
       *
       * @throws {Error}
       *
       * > https://trello.com/c/r86sweSs/159-sailsdownload
       */
      if (sails.download !== undefined) { throw new Error('Cannot attach `sails.download()` because, for some reason, it already exists!'); }
      if (sails.downloadOne !== undefined) { throw new Error('Cannot attach `sails.downloadOne()` because, for some reason, it already exists!'); }
      sails.download = sails.downloadOne = function (){
        throw new Error(
          'Did you mean `sails.startDownload()`?\n'+
          '\n'+
          'Example usage:\n'+
          '\n'+
          '    var downloading = await sails.startDownload();\n'+
          '    return downloading;\n'
        );
      };//ƒ



      /**
       * .startDownload()
       *
       * Create a download stream for a particular file descriptor.
       *
       * (A no-op error listener is automatically attached to prevent crashing the process,
       * but note that errors should be _actually handled_ in userland code via another 'error'
       * listener.  This method is primarily designed for more advanced use, such as moving
       * a file from one place to another.  Use the higher-level `.download()` method for
       * performing basic file downloads.)
       *
       * @param {String} fd
       * @param {Dictionary?} moreOptions
       * @param {Function?} _explicitCbMaybe
       *
       * @returns {Deferred}
       *          @returns {Stream} [readable stream]
       */
      if (sails.startDownload !== undefined) { throw new Error('Cannot attach `sails.startDownload()` because, for some reason, it already exists!'); }
      sails.startDownload = function (fd, moreOptions, _explicitCbMaybe){

        var explicitCb = _.isFunction(moreOptions) ? moreOptions : _explicitCbMaybe;

        var omen = flaverr.omen(sails.startDownload);
        //^In development and when debugging, we use an omen for better stack traces.

        if (!_.isString(fd) || fd === '') {
          throw new Error('Provided "fd" aka file descriptor is invalid.  Expecting a truthy string, but instead got '+util.inspect(fd));
        }//•

        return parley(
          (done)=>{

            var downloadOpts = _.extend({}, sails.config.uploads, moreOptions);

            // Use a little pocket function to load up the appropriate adapter.
            // (During uploads, we just rely on Skipper for this part. But here, for this
            // use case, we have to do it ourselves.)
            var adapter = (()=>{
              let _adapter = downloadOpts.adapter || defaultFilesystemAdapter;
              if (_.isFunction(_adapter)) {
                _adapter = _adapter(downloadOpts);
              }
              return _adapter;
            })();

            var stream = adapter.read(fd);

            // Bind a no-op handler for the `error` event to prevent it from crashing the process if it fires.
            // (userland code can still bind and use its own error events).
            stream.on('error', ()=>{ /* … */ });//æ
            // ^ Since event handlers are garbage collected when the event emitter is itself gc()'d, it is safe
            // for us to bind this event handler here without necessarily removing it.

            // Also bind a one-time error handler specifically to catch the first error that occurs,
            // IF one occurs before the first "readable" event fires.  (In other words, this allows us
            // to more gracefully handle errors that might occur before a file even BEGINS to download.)
            var onDownloadError = (err)=>{
              stream.removeListener('readable', onFirstReadable);//eslint-disable-line no-use-before-define
              return done(flaverr({
                message: 'Download failed.  '+err.message,
                raw: err
              }, omen));
            };//ƒ
            stream.once('error', onDownloadError);//æ

            var onFirstReadable =  ()=>{
              stream.removeListener('error', onDownloadError);
              return done(undefined, stream);
            };
            stream.once('readable', onFirstReadable);//æ

          },
          explicitCb||undefined,
          undefined,
          undefined,
          omen
        );

      };//ƒ


      /**
       * .transload()
       * .transloadOne()
       *
       * (just aliases to help avoid typos/confusion)
       *
       * @throws {Error}
       */
      if (sails.transload !== undefined) { throw new Error('Cannot attach `sails.transload()` because, for some reason, it already exists!'); }
      sails.transload = sails.transloadOne = function (){
        throw new Error(
          'Did you mean `sails.cp()`?\n'+
          '\n'+
          'Example usage:\n'+
          '\n'+
          '    var file = await sails.cp(srcFd, srcOpts, destOpts);\n'+
          '    await User.update(1).set({ avatarFd: file.fd });'
        );
      };//ƒ


      /**
       * .cp()
       *
       * Stream a file from one place to another.
       *
       * > This is a combination of .startDownload() and .uploadOne().
       * > See https://trello.com/c/ykPMDusk for more information.
       *
       * @param {String} srcFd
       * @param {Dictionary} moreSrcOptions
       * @param {Dictionary} moreDestOptions
       * @param {Function?} _explicitCbMaybe
       *
       * @returns {Deferred}
       *          @returns {Dictionary}
       *              @property {String} fd   [the new file descriptor]
       *              @property {String} type
       */
      if (sails.cp !== undefined) { throw new Error('Cannot attach `sails.cp()` because, for some reason, it already exists!'); }
      sails.cp = function (srcFd, moreSrcOptions, moreDestOptions, _explicitCbMaybe){

        var explicitCb = _.isFunction(moreDestOptions) ? moreDestOptions : _explicitCbMaybe;

        var omen = flaverr.omen(sails.cp);
        //^In development and when debugging, we use an omen for better stack traces.

        return parley(
          (done)=>{

            var srcOpts = _.extend({}, sails.config.uploads, moreSrcOptions);
            var destOpts = _.extend({}, sails.config.uploads, moreDestOptions);

            sails.startDownload(srcFd, srcOpts).exec((err, readable)=>{
              if (err) { return done(err); }
              readable.once('error', (err)=>{ return done(err); });//œ

              sails.uploadOne(readable, destOpts).exec((err, file)=>{
                if (err) { return done(err); }
                return done(undefined, file);
              });//_∏_
            });//_∏_
          },
          explicitCb||undefined,
          undefined,
          undefined,
          omen
        );
      };//ƒ



      /**
       * .reservoir()
       *
       * Convert the incoming Readable/Upstream into an array of info dictionaries,
       * each containing an encoded string representing data or file contents.
       *
       * WARNING: This is potentially very memory-intensive!  Only use if you
       * know what you're doing!!
       *
       * @param {Ref} upstreamOrFileStream
       * @param {Dictionary?} options
       *        @property {String?} encoding  (defaults to 'utf8', but also supports 'base64')
       * @param {Function?} explicitCbMaybe
       *
       * @returns {Deferred}
       *          @returns {Array}
       *              @of {Dictionary}
       *                  @property {String} contentBytes   (encoded bytes, utf8 by default)
       *                  @property {String?} name          (file name, if available)
       *                  @property {String?} type          (mime type, if available)
       */
      if (sails.reservoir !== undefined) { throw new Error('Cannot attach `sails.reservoir()` because, for some reason, it already exists!'); }
      sails.reservoir = function (upstreamOrFileStream, options, explicitCbMaybe){
        var omen = flaverr.omen(sails.reservoir);
        //^In development and when debugging, we use an omen for better stack traces.

        options = options || {};
        if (options.maxBytes) {
          throw new Error('`maxBytes` option is not supported yet for `sails.reservoir()`');// TODO
        }//•
        if (!_.contains([undefined, 'utf8', 'base64'], options.encoding)) {
          throw new Error('If specified, `encoding` option should be set to either \'utf8\' or \'base64\'.');
        }//•

        var outputEncoding;
        if (options.encoding === undefined) {
          outputEncoding = 'utf8';
        } else {
          outputEncoding = options.encoding;
        }

        return parley(
          function (done){

            // Handle non-upstream case first: (i.e. just a normal Readable stream):
            try {
              verifyUpstream(upstreamOrFileStream, omen);
            } catch (err) {
              if (flaverr.taste('E_NOT_AN_UPSTREAM', err)) {
                let readable = upstreamOrFileStream;
                damReadableStream(readable, outputEncoding, omen)
                .exec((err, fileContentsAsString)=>{
                  if (err) { return done(err); }//•
                  let sniffed;
                  try {
                    sniffed = sniffReadableStream(readable, omen);
                  } catch (err) { return done(err); }//•
                  return done(undefined, [
                    {
                      contentBytes: fileContentsAsString,//« utf8-encoded or base64-encoded bytes
                      name: sniffed.name,//« original file name (if stream had something sniffable)
                      type: sniffed.type,//« MIME type (if stream had something sniffable)
                    }
                  ]);
                });//_∏_
                return;//•
              } else {
                return done(err);
              }
            }//•

            {// •- Otherwise, IWMIH, then we're dealing with an Upstream instance:
              let encodedThings = [];
              let firstMajorErrorBesidesTheUpstreamEmittingError;
              upstreamOrFileStream.on('error', (err)=>{
                return done(err);
              });//œ
              upstreamOrFileStream.on('data', (readable)=>{
                if (firstMajorErrorBesidesTheUpstreamEmittingError) {
                  // If we've already hit a major error, then don't try to do anything else-
                  // just keep on waiting till everything's done so we can report it.
                  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                  // FUTURE: we could optimize this, although it's unlikely to matter--
                  // as it is, you're already loading entire files into memory!  This
                  // isn't something that will ever work for really big files anyway...
                  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                  return;
                }//•
                damReadableStream(readable, outputEncoding, omen).exec((err, fileContentsAsEncodedString)=>{
                  if (err) {
                    firstMajorErrorBesidesTheUpstreamEmittingError = firstMajorErrorBesidesTheUpstreamEmittingError || err;
                  } else {
                    let sniffed;
                    try {
                      sniffed = sniffReadableStream(readable, omen);
                    } catch (err) {
                      firstMajorErrorBesidesTheUpstreamEmittingError = firstMajorErrorBesidesTheUpstreamEmittingError || err;
                    }
                    encodedThings.push({
                      contentBytes: fileContentsAsEncodedString,
                      name: sniffed.name,
                      type: sniffed.type,
                    });
                  }//ﬁ
                });//_∏_
              });//œ
              upstreamOrFileStream.on('end', ()=>{
                if (firstMajorErrorBesidesTheUpstreamEmittingError) {
                  return done(firstMajorErrorBesidesTheUpstreamEmittingError);
                }
                return done(undefined, encodedThings);
              });//œ
            }//∫
          },
          explicitCbMaybe||undefined,
          undefined,
          undefined,
          omen
        );
      };//ƒ


      /**
       * .uploadToBase64()
       *
       * Convert the incoming Readable/file upload(s) into encoded strings.
       *
       * WARNING: This is potentially very memory-intensive!  Only use if you
       * know what you're doing!!
       *
       * @param {Ref} upstreamOrFileStream
       * @param {Dictionary?} options
       * @param {Function?} explicitCbMaybe
       *
       * @returns {Deferred}
       *          @returns {Array}
       *              @of {Dictionary}
       *                  @property {String} contentBytes   (base64 encoded bytes)
       *                  @property {String?} name          (file name, if available)
       *                  @property {String?} type          (mime type, if available)
       */
      if (sails.uploadToBase64 !== undefined) { throw new Error('Cannot attach `sails.uploadToBase64()` because, for some reason, it already exists!'); }
      sails.uploadToBase64 = function (upstreamOrFileStream, options, explicitCbMaybe){
        var omenForDeprecationWarning = flaverr.omen(sails.uploadToBase64);
        console.warn(flaverr({
          message:
          'warn: `sails.uploadToBase64()` is deprecated in favor of its more flexible cousin: `sails.reservoir()`\n'+
          '\n'+
          'Example usage:\n'+
          '\n'+
          '    var encodedUploads = await sails.reservoir(incoming, {encoding: \'base64\'});\n'+
          '\n'+
          '(Tip: The following stack trace might help locate where this is being called from.)'
        }), omenForDeprecationWarning);
        return sails.reservoir(upstreamOrFileStream, _.extend({ encoding: 'base64' }, options||{}), explicitCbMaybe);
      };//ƒ



      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // FUTURE: `await sails.mv(fd, destWritable, moreOptions)`
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


      /**
       * .rm()
       *
       * Remove an uploaded file.
       *
       * @param {String} fd
       * @param {Dictionary?} moreOptions
       * @param {Function?} _explicitCbMaybe
       *
       * @returns {Deferred}
       */
      if (sails.rm !== undefined) { throw new Error('Cannot attach `sails.rm()` because, for some reason, it already exists!'); }
      sails.rm = function (fd, moreOptions, _explicitCbMaybe){
        var explicitCb = _.isFunction(moreOptions) ? moreOptions : _explicitCbMaybe;

        var omen = process.env.NODE_ENV !== 'production' || process.env.DEBUG ? flaverr({}, new Error('omen'), sails.rm) : undefined;
        //^In development and when debugging, we use an omen for better stack traces.

        return parley(
          (done)=>{
            var adapterOpts = _.extend({}, sails.config.uploads, moreOptions);

            // Use a little pocket function to load up the appropriate adapter.
            // (During uploads, we just rely on Skipper for this part. But here, for this
            // use case, we have to do it ourselves.)
            var adapter = (()=>{
              let _adapter = adapterOpts.adapter || defaultFilesystemAdapter;
              if (_.isFunction(_adapter)) {
                _adapter = _adapter(adapterOpts);
              }
              return _adapter;
            })();

            adapter.rm(fd, function (err){
              if (err) { return done(err); }
              return done();
            });//_∏_
          },
          explicitCb||undefined,
          undefined,
          undefined,
          omen
        );
      };//ƒ


      /**
       * .ls()
       *
       * List all uploaded files.
       *
       * @param {Function?} _explicitCbMaybe
       *
       * @returns {Deferred}
       *          @returns {Array}
       */
      if (sails.ls !== undefined) { throw new Error('Cannot attach `sails.ls()` because, for some reason, it already exists!'); }
      sails.ls = function (_explicitCbMaybe){
        var explicitCb = _.isFunction(_explicitCbMaybe) ? _explicitCbMaybe : undefined;

        var omen = process.env.NODE_ENV !== 'production' || process.env.DEBUG ? flaverr({}, new Error('omen'), sails.ls) : undefined;
        //^In development and when debugging, we use an omen for better stack traces.

        return parley(
          (done)=>{
            var adapterOpts = _.extend({}, sails.config.uploads);

            // Use a little pocket function to load up the appropriate adapter.
            // (During uploads, we just rely on Skipper for this part. But here, for this
            // use case, we have to do it ourselves.)
            var adapter = (()=>{
              let _adapter = adapterOpts.adapter || defaultFilesystemAdapter;
              if (_.isFunction(_adapter)) {
                _adapter = _adapter(adapterOpts);
              }
              return _adapter;
            })();

            // Determine appropriate dirpath to search
            var dirpath = path.resolve(
              process.cwd(),
              sails.config.appPath,
              adapterOpts.dirpath||'./'
            );

            adapter.ls(dirpath, function (err, previouslyUploadedFiles){
              if (err) { return done(err); }
              return done(undefined, previouslyUploadedFiles);
            });//_∏_
          },
          explicitCb||undefined,
          undefined,
          undefined,
          omen
        );
      };//ƒ


      return done();

    },

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // FUTURE: Add support for generic req.upload() functionality:
    // routes: {
    //   before: {
    //     '/*': (req, res, next)=>{

    //       // Expose `req.upload(…)` method, if it is not already set
    //       // (this is allow it to be overridden, if absolutely necessary)
    //       if (req.upload === undefined) {
    //         req.upload = function (moreOptions, _explicitCbMaybe){//eslint-disable-line no-unused-vars
    //           // throw new Error('Not implemented yet');
    //           var omen = flaverr.omen(req.upload);
    //           return sails.uploadAny(req, moreOptions, _explicitCbMaybe, omen);
    //         };
    //       }//ﬁ

    //       next();
    //     }//œ
    //   }
    // }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  };

};
