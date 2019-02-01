# sails-hook-uploads

Adds an easier interface for working with file uploads and downloads in your Node.js/Sails app.  Supports async/await.

**Only supports [Node 8](https://nodejs.org) and up.**

```js
npm install sails-hook-uploads
```


## Usage

```js
var uploaded = await sails.uploadOne(inputs.someFile);
```

Available methods:

- .uploadOne(upstreamOrReadable)    _(supports Sails single-file upload of 0 or 1 file, **or** any Readable stream)_
- .upload(upstream)  _(accepts incoming Sails file uploads consisting of 0 files, 1 file, 2 files, or more)_
- .startDownload(fd)  _(useful for downloading a file; returns a Readable)_
- .cp(srcFd, srcOpts, destOpts)  _(useful for transloading an already-uploaded file to a different destination)_
- .rm(fd)
- .ls()

All methods use configuration from `sails.config.uploads`.  Most inherited settings can be overridden (see source code for details- it's pretty simple in there).

For more usage tips, see the [Ration.io example app and tutorial course](https://ration.io/).


## License

MIT

&copy; 2017-present  Rachael Shaw, Mike McNeil
