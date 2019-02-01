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

- .upload()  _(supports Sails single or multi-file upload)_
- .uploadOne()    _(supports Sails single-file upload or any Readable stream; useful for transloading)_
- .uploadToBase64()  _(supports Sails single-file upload or any Readable stream)_
- .startDownload()
- .cp()
- .ls()
- .rm()

All methods use configuration from `sails.config.uploads`.  Most inherited settings can be overridden (see source code for details- it's pretty simple in there).

For more usage tips, see the [Ration.io example app and tutorial course](https://ration.io/).


## License

MIT

&copy; 2017-present  Rachael Shaw, Mike McNeil
