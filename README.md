SimpleFolderWatcher
==========

[![Build Status](https://travis-ci.org/greggman/simple-folder-watcher.svg?branch=master)](https://travis-ci.org/greggman/simple-folder-watcher)

Watches a directory for changes. To watch a tree see [simple-tree-watcher](https://github.com/greggman/simple-tree-watcher)

Hopefully it actually works unlike other watch libaries

## Example:

```
const SimpleFolderWatcher = require('simple-folder-watcher');

var dir = process.argv[2];
console.log("watching: ", dir);

var watcher = new SimpleFolderWatcher(dir);
watcher.on('add',    function(f, s)     { show("add   :", f, s    ); });
watcher.on('create', function(f, s)     { show("create:", f, s    ); });
watcher.on('remove', function(f, s, s2) { show("remove:", f, s, s2); });
watcher.on('change', function(f, s)     { show("change:", f, s    ); });

function show(event, filepath, stat, oldStat) {
  console.log(event, filepath, stat.isDirectory() ? "dir" : "file");
}
```

## Docs

create an instance of `SimpleFolderWatcher` and attach events.

`new SimpleFolderWatcher(path, options)`

`SimpleFolderWatcher` is an `EventEmitter` so it has [the standard `EventEmitter` api](https://nodejs.org/api/events.html#events_class_eventemitter).

### Events

#### `'add'`

Emitted for every entry when you first start. Passed filename and stat

#### `'create'`

Emitted when an file or folder is created. Passed filename and stat

#### `'remove'`

Emitted when a file is deleted. Passed filename and last stat

#### `'change'`

Emitted when a file is change. Passed the filename, current stat, previous stat

### Options

`filter`

A function that is passed the path for every file and directory. It should return `true`
to keep the file or directory or `false` to reject it. The path passed
is relative to the original path when `SimpleFolderWatcher` was created.

### Methods

#### `close`

Stops watching the tree. No more events will be sent.

## Philosophy / Goals

My hope is there will be no surprises. You will never get a `change` or `remove`
event for something that you didn't previously get an `add` or `create` event for.

I didn't feel like adding a globbing options is a good thing. It would just bloat the
library. You can write your own filter in a 1-3 lines of code so it seemed best to let
you pick your own filtering methods

Similarly some watch function have debouncing options etc. All of that can be layered
over this level. No need to bloat/clutter/obfusticate this simple library.

## Platform Issues

Each platform behaves slightly different. In my testing

### OSX

Add a file get a `create` event for the file

### Windows

Add a file get a `create` event for the file and a `change` event for the parent folder

Also on Windows a watcher may hold a lock or temp lock on a folder.
I haven't tracked this down. In the tests I delete a subfolder
which internally I instantly get an `'EPERM'` error from the watcher
for that folder. I handle that case. But, at the end of the test
I delete all the test files. Those deletes failed unless I closed
the watcher.

### Linux

Add a file get both `create` event and a `change` event for the file

