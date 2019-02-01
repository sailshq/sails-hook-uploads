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

- .uploadOne(upstreamOrReadable)    _(accepts any Readable stream, **or** an incoming Sails file upload of 0 or 1 file; returns either `undefined` or a dictionary w/ information about the uploaded file data.)_
- .upload(upstream)  _(accepts any incoming Sails file upload -- whether it consists of 0, 1, or ≥2 files; returns an array regardless.)_
- .reservoir(upstreamOrReadable)  _(accepts any Readable stream, **or** any incoming Sails file upload -- whether it consists of 0, 1, or ≥2 files; returns an array regardless.)_
- .startDownload(fd)  _(useful for downloading a file; returns a Readable)_
- .cp(srcFd, srcOpts, destOpts)  _(useful for transloading an already-uploaded file to a different destination)_
- .rm(fd)
- .ls()

All methods use configuration from `sails.config.uploads`.  Most inherited settings can be overridden (see source code for details- it's pretty simple in there).

For more usage tips, see the [Ration.io example app and tutorial course](https://ration.io/).


## License

MIT

&copy; 2017-present  Rachael Shaw, Mike McNeil
