'use strict';

const debug = require('../lib/debug')('index-test');  // eslint-disable-line
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SimpleFolderWatcher = require('../index.js');
const EventRecorder = require('../test-lib/event-recorder');
const TestFS = require('../test-lib/test-fs');

describe('SimpleFolderWatcher - basic', function() {

  // NOTE: We use the real filesystem because we need to test
  // across plaforms that it works on those actual platforms.
  // I'm too lazy to make a tmpdir with some modules so ...
  var tempDir = path.join(__dirname, "temp");
  var initialContent = "abc";
  var newContent = "abcdef";
  var watcher;
  var recorder;
  var nameAtRoot = path.join(tempDir, "moo.txt");
  var nameOfSub = path.join(tempDir, "sub1b");
  var nameAtSub = path.join(nameOfSub, "moo3.txt");
  var nameOfSubSub = path.join(nameOfSub, "sub2b");
  var timeout = 1000;
  var testFS = new TestFS();

  function wait(fn) {
    setTimeout(fn, timeout);
  }

  before(function(done) {
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
              name: "sub2",
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
    done();
  });

  after(function(done) {
    watcher.close();
    testFS.cleanup();
    done();
  });

  function noMoreEvents() {
    if (recorder) {
      recorder.setCheck((e) => {
        assert.ok(false, 'no events should happen. got: "' + e.event + '" event for ' + e.name + (e.stat.isDirectory() ? ' directory' : (', size: ' + e.stat.size + (e.oldStat ? (', oldSize: ' + e.oldStat.size) : ''))));
      });
    }
  }

  beforeEach(function() {
    noMoreEvents();
    if (recorder) {
      recorder.clear();
    }
  });

  // yes I know these tests are dependent but it wasn't clear to me
  // at the time how to make them both simple and not be a pita
  it('reports existing files', (done) => {
    watcher = new SimpleFolderWatcher(tempDir);
    recorder = new EventRecorder(watcher);

    wait(() => {
      var added = new Map();
      var events = recorder.getEvents();
      events.forEach((e) => {
        switch (e.event) {
          case 'add':
            assert.ok(!added.has(e.name));
            added.set(e.name);
            break;
          case 'change':
            var addEvents = recorder.getEvents('add', e.name);
            assert.equal(addEvents.length, 1, 'there is one add event for a change event');
            assert.ok(addEvents[0].id < e.id, 'add event came first');
            break;
          default:
            assert.ok(false, "must be add or create");
            break;
        }
        if (e.stat.isDirectory()) {
          assert.ok(testFS.createdDirs.indexOf(e.name) >= 0, 'should be expected directory');
        } else {
          assert.ok(testFS.createdFiles.indexOf(e.name) >= 0, 'should be expected file');
          assert.equal(e.stat.size, initialContent.length);
        }
      });
      // -1 because the root is in the list
      assert.equal(added.size, 4);
      assert.ok(!added.has(tempDir));
      assert.equal(watcher._entries.size, 4);
      noMoreEvents();
      done();
    });
  });

  it('reports file created to root', (done) => {
    // check we get create followed by optional change
    var receivedEvents = new Set();
    wait(() => {
      assert.ok(receivedEvents.has("create"), "must have created event");
      assert.equal(watcher._entries.size, 5);
      noMoreEvents();
      done();
    });
    recorder.setCheck((e) => {
      if (!receivedEvents.has('create')) {
        assert.equal(e.event, 'create', 'event is "create"');
      } else {
        assert.equal(e.event, 'change', 'event is "change"');
      }
      assert.ok(!receivedEvents.has(e.event), 'event recevied once');
      receivedEvents.add(e.event);
      assert.equal(e.name, nameAtRoot, 'name is ' + nameAtRoot);
      assert.equal(e.stat.size, initialContent.length);
    });
    testFS.writeFile(nameAtRoot, initialContent);
  });

  it('reports file changed at root', (done) => {
    wait(() => {
      var events = recorder.getEvents();
      // Check we got only change events
      events.forEach((e) => {
        assert.equal(e.event, 'change', 'event is "change"');
        assert.equal(e.name, nameAtRoot, 'name is ' + nameAtRoot);
        assert.equal(e.stat.size, newContent.length);
      });
      assert.equal(watcher._entries.size, 5);
      noMoreEvents();
      done();
    });
    testFS.writeFile(nameAtRoot, newContent);
  });

  it('reports file removed from root', (done) => {
    recorder.setCheck((e) => {
      assert.equal(e.event, 'remove', 'event is "remove"');
      assert.equal(e.name, nameAtRoot, 'name is ' + nameAtRoot);
      assert.equal(e.stat.size, newContent.length);
      noMoreEvents();
      wait(() => {
        assert.equal(watcher._entries.size, 4);
        done();
      });
    });
    fs.unlinkSync(nameAtRoot);
  });

  it('reports added subfolder', (done) => {
    // Windows adds change event for parent subfolder
    wait(() => {
      var createEvents = recorder.getEvents('create');
      assert.equal(createEvents.length, 1, "there is one create event");
      assert.equal(createEvents[0].name, nameOfSub, 'name is ' + nameOfSub);
      assert.ok(createEvents[0].stat.isDirectory());
      var changeEvents = recorder.getEvents('change');
      assert.equal(recorder.getEvents().length, createEvents.length + changeEvents.length, "there are only change and create events");
      if (changeEvents.length) {
        var parentPath = path.dirname(nameOfSub);
        assert.equal(changeEvents.length, 1, "there is only one create event");
        assert.equal(changeEvents[0].name, parentPath, 'name is ' + parentPath);
        assert.ok(changeEvents[0].stat.isDirectory());
      }

      noMoreEvents();
      done();
    });
    testFS.mkdir(nameOfSub);
  });

  it('does not report file added to subfolder', (done) => {
    // OSX gets a created event for file
    // Windows gets a created event for file and a changed event for parent folder
    // Ubuntu gets a created event for file and a changed event for file
    wait(() => {
      assert.equal(recorder.getEvents('create').length, 0, "there's are no events");
      noMoreEvents();
      done();
    });
    testFS.writeFile(nameAtSub, initialContent);
  });

  it('does not report file changed at subfolder', (done) => {
    // Check we got only change events
    wait(() => {
      var events = recorder.getEvents();
      assert.equal(events.length, 0, "there's no change event for file in subfolder");
      noMoreEvents();
      done();
    });
    testFS.writeFile(nameAtSub, newContent);
  });

  it('does not report file removed from subfolder', (done) => {
    wait(() => {
      var events = recorder.getEvents();
      assert.equal(events.length, 0, "there's no change event for file in subfolder");
      noMoreEvents();
      done();
    });
    fs.unlinkSync(nameAtSub);
  });

  it('does not report sub folder added to subfolder', (done) => {
    wait(() => {
      var events = recorder.getEvents();
      assert.equal(events.length, 0, "there's no change event for file in subfolder");
      noMoreEvents();
      done();
    });
    testFS.mkdir(nameOfSubSub);
  });

  it('does not report sub folder removed from subfolder', (done) => {
    wait(() => {
      var events = recorder.getEvents();
      assert.equal(events.length, 0, "there's no change event for file in subfolder");
      noMoreEvents();
      done();
    });
    fs.rmdirSync(nameOfSubSub);
  });

});

