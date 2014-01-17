wp2ghost
========

Convert wordpress XML export data into a JSON file that ghost can import


##installation

  npm install
  

##conversion

- go to Wordpress - Tools - Export All, get the backup.xml
- run `node index backup.xml` to get the json file
- go to http://yourghostblog.com/ghost/debug, import the json file 
