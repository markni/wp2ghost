wp2ghost
========

Convert wordpress XML export data into a JSON file that ghost can import


##installation

  npm install
  

##conversion

- go to Wordpress - Tools - Export All, get the backup.xml
- run `node wp2ghost backup.xml`, a 'backup.xml.json' file will be created in the same directory
- go to http://your-ghost-blog.com/ghost/debug, import the generated json file
