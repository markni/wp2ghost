wp2ghost [![Build Status](https://travis-ci.org/markni/wp2ghost.svg?branch=master)](https://travis-ci.org/markni/wp2ghost)
========

Convert wordpress XML export data (WordPress eXtended RSS or WXR) into a JSON file that ghost can import

[![NPM](https://nodei.co/npm/wp2ghost.png?downloads=true)](https://nodei.co/npm/wp2ghost/)


##System requirement

- requires nodejs 0.10 or higher

##Installation

- Run `npm install -g wp2ghost`
  - For linux, might need `sudo npm install -g wp2ghost` instead

alternatively, you could

- Download [zip package](https://github.com/markni/wp2ghost/archive/master.zip) and unpack.
- Run `npm install` in package folder


##Conversion

- Go to Wordpress - Tools - Export All, get the backup.xml
- Run `wp2ghost backup.xml`, a 'backup.xml.json' file will be created in the same directory
  - run `node wp2ghost backup.xml` only if you used the second installation method (or `nodejs wp2ghost backup.xml` if you're using Debian)
- Go to http://your-ghost-blog.com/ghost/debug, import the generated json file

![](https://cloud.githubusercontent.com/assets/1743179/5001686/6e8ac9b8-69ad-11e4-9591-d962d3b87928.jpg)

##Known Issues

- This tool may break some of the contents inside ``<code>`` and ``<pre>`` blocks, use as your own risk


##License

MIT
