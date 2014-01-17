wp2ghost
========

Convert wordpress XML export data (WordPress eXtended RSS or WXR) into a JSON file that ghost can import

![](http://nagi.ca/u/769a93e5e676.png)


##system requirement

- need have nodejs installed

##installation

- Download [zip package](https://github.com/xna2/wp2ghost/archive/master.zip) and unpack.
- run `npm install` in package folder
  

##conversion

- go to Wordpress - Tools - Export All, get the backup.xml
- run `node wp2ghost backup.xml`, a 'backup.xml.json' file will be created in the same directory
- go to http://your-ghost-blog.com/ghost/debug, import the generated json file


