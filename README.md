# sails-hook-uploads

Adds an easier interface for working with file uploads and downloads in your Node.js/Sails app.  Supports ES8 async/await.

**Only supports [Node 8](https://nodejs.org) and up.**

> This is **not** a core hook in the Sails.js framework -- it is a 3rd party hook.  You can override or disable it using your sailsrc file or environment variables.  See [Concepts > Configuration](http://sailsjs.com/docs/concepts/configuration) for more information.


```js
npm install sails-hook-uploads
```

```js
var uploaded = await sails.uploadOne(inputs.myFile);
```

For more usage tips, see the [Platzi course on Sails.js](https://courses.platzi.com).


## License

MIT

&copy; 2017  Rachael Shaw, Mike McNeil
