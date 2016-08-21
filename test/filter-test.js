'use strict';

const debug = require('../lib/debug')('filter-test');  // eslint-disable-line
const assert = require('assert');
const path = require('path');
const SimpleFolderWatcher  = require('../index.js');
const EventRecorder = require('../test-lib/event-recorder');
const TestFS = require('../test-lib/test-fs');

describe('SimpleFolderWatcher - filtering:', function() {

  // NOTE: We use the real filesystem because we need to test
  // across plaforms that it works on those actual platforms.
  // I'm too lazy to make a tmpdir with some modules so ...
  var tempDir = path.join(__dirname, "temp");
  var initialContent = "abc";
  var newContent = "abcdef";
  var watcher;
  var recorder;
  var timeout = 1000;
  var testFS = new TestFS();

  function wait(fn) {
    if (recorder) {
      recorder.setCheck(() => {});
    }
    setTimeout(fn, timeout);
  }

  function afterHelp(done) {
    watcher.close();
    testFS.cleanup();
    watcher = null;
    recorder = null;
    wait(done);
  }

  function noMoreEvents() {
    if (recorder) {
      recorder.setCheck((e) => {
        assert.ok(false, 'no events should happen. got: "' + e.event + '" event for ' + e.name + (e.stat.isDirectory() ? ' directory' : (', size: ' + e.stat.size + (e.oldStat ? (', oldSize: ' + e.oldStat.size) : ''))));
      });
    }
  }

  function beforeHelp(done) {
    noMoreEvents();
    if (recorder) {
      recorder.clear();
    }
    done();
  }

  function addFiles() {
    testFS.makeFS(tempDir, {
      files: [
        "foo.txt",
        "bar.js",
        ".foo",
      ],
      dirs: [
        {
          name: "sub1",
          files: [
            "foo2a.txt",
            "foo2b.txt",
            "bar2.js",
            ".foo2",
          ],
          dirs: [
            {
              name: ".sub2",
              files: [
                "foo3a.txt",
                "foo3b.txt",
                "foo3c.txt",
                "bar3.js",
                ".foo3",
              ],
            },
          ],
        },
      ],
    }, initialContent);
  }

  describe('ignores dot files:', function() {

    var newDotFile = path.join(tempDir, ".test");
    var newFolder = path.join(tempDir, ".stuff");

    before((done) => {
      beforeHelp(done);
    });

    after((done) => {
      afterHelp(done);
    });


    it('ignores dot files on start', (done) => {
      addFiles();

      function notStartsWithDot(filename) {
        return path.basename(filename)[0] !== ".";
      }

      watcher = new SimpleFolderWatcher(tempDir, { filter: notStartsWithDot });
      recorder = new EventRecorder(watcher);
      wait(() => {
        var added = new Map();
        var events = recorder.getEvents();
        events.forEach((e) => {
          assert.equal(e.event, 'add', 'event must be add');
          assert.ok(!added.has(e.name));
          added.set(e.name);
          if (e.stat.isDirectory()) {
            assert.ok(testFS.createdDirs.indexOf(e.name) >= 0, 'should be directory');
          } else {
            assert.ok(testFS.createdFiles.indexOf(e.name) >= 0, 'should be file');
            assert.equal(e.stat.size, initialContent.length);
          }
        });
        // -1 because the root is in the list
        assert.equal(added.size, 3);
        assert.equal(watcher._entries.size, 3);
        noMoreEvents();
        done();
      });
    });

    it('ignores new dot files', (done) => {
      wait(() => {
        var events = recorder.getEvents('create');
        events.forEach((e) => {
          assert.ok(e.name[0] !== '.', "not dot files");
          assert.ok(e.event !== 'add' && e.event !== 'create', 'no add or create events');
        });
        noMoreEvents();
        done();
      });
      testFS.writeFile(newDotFile, initialContent);
    });

    it('ignores change to dot files', (done) => {
      wait(() => {
        var events = recorder.getEvents();
        events.forEach((e) => {
          assert.ok(e.name[0] !== '.', "not dot files");
        });
        noMoreEvents();
        done();
      });
      testFS.writeFile(newDotFile, newContent);
    });

    it('ignores new folder with dot files', (done) => {
      wait(() => {
        var events = recorder.getEvents('create');
        events.forEach((e) => {
          assert.ok(e.name[0] !== '.', "not a dot file");
        });
        noMoreEvents();
        done();
      });
      testFS.makeFS(newFolder, {
        files: [
          "foo9.txt",
          ".bla",
        ],
      }, initialContent);
    });
  });

  //
  //
  //it('ignores globs', function(done) {
  //    done();
  //});
  //
  //it('ignores regex', function(done) {
  //    done();
  //});
  //
  //it('ignores functions', function(done) {
  //    done();
  //});

});

