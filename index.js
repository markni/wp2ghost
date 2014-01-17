var fs = require('graceful-fs'),

	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	async = require('async'),
	_ = require('underscore'),
	tomd = require('to-markdown').toMarkdown,
	EOL = require('os').EOL,
	EOLre = new RegExp(EOL, 'g');



var source = process.argv.pop()
console.log(source);

var file  = {};

var textProcess = function(str){
	console.log('Removing OS tags.');
	// Transform EOL
	var str = EOL === '\n' ? str : str.replace(EOLre, '\n');
	str = str.replace('<br />','\n');
	str = str.replace('<br>','\n');
	str = str.replace('<br/>','\n');
	str = str.replace(/^([^\n]+)\n*(-|=){2,} *(?:\n+|$)/g, '<hr>');
	// Remove UTF BOM
	str = str.replace(/^\uFEFF/, '');

	return str;
};


file.read = function(source, callback){
	fs.exists(source, function(exist){
		if (exist){
			fs.readFile(source, 'utf8', function(err, result){
				if (err) return callback(err);
				callback(null, result);
			});
		} else {
			callback(null);
		}
	});
};


var writeFile = function(destination, content, callback) {
	fs.open(destination, "w", function(err, fd) {
		if (err) callback(err);
		fs.write(fd, content, 0, "utf8", function(err, written, buffer) {
			callback(err);
		});
	});
};


file.write = function(content, callback){
	fs.writeFile('test.json', content, callback);
};


if (!source) return console.log('\nUsage: node index.js wordpress');

async.waterfall([
	function(next){
		console.log('Fetching %s.', source);

		file.read(source, next);
	},
	function(data,next){
		console.log('Removing OS tags.');
		// Transform EOL
		var data = EOL === '\n' ? data : data.replace(EOLre, '\n');

		// Remove UTF BOM
		data = data.replace(/^\uFEFF/, '');



		next(null, data);
	},
	function(data, next){
		console.log('Parsing XML.');
		parser.parseString(data, next);
	},
	function(data, next){
		var ghost = {};
		var tag_name_map = {};
		ghost.meta = {"exported_on": (+new Date()), "version":"000"};
		ghost.data = {};
		ghost.data.posts = [];
		ghost.data.tags = [];
		ghost.data.posts_tags = [];

		console.log('Analyzing.');

		var length = 0,
			arr = data.rss.channel[0].item;

		var tags = data.rss.channel[0]['wp:tag'];

		tags.forEach(function(item){
			var tag = {};
			console.log(item);
			tag.id = parseInt(item['wp:term_id'][0]);
			tag.name = item['wp:tag_name'][0];
			tag.slug = item['wp:tag_slug'][0];
			tag.slug = tag.slug.slice(0,150);
			tag.description = '';

			tag_name_map[tag.name] = tag.id;


			ghost.data.tags.push(tag);



		});



		async.forEach(arr, function(item, next){
			var post = {};


			var postTitle = item.title[0],
				id = parseInt(item['wp:post_id'][0]),
				postDate = item['wp:post_date'][0],
				postLink = item['wp:post_name'][0].slice(0,150),
				postContent = item['content:encoded'][0],
				postComment = item['wp:comment_status'][0] === 'open' ? true : false;

			if (_.isObject(postTitle)) postTitle = '';
			if (!postLink || _.isObject(postLink)) {
				if (postTitle)
					postLink = postTitle.toLowerCase().split(' ').join('-');
				else {
					// Have to use post_id if both title and post_name are empty
					postLink = item['wp:post_id'][0];
				}
			}

			postLink = item['wp:post_id'][0];
			postContent = _.isObject(postContent) ? '' : tomd(postContent);

			//additional fix for tomarkdown

			postContent = postContent.replace(/\r\n/g, '\n');
			postContent = postContent.replace(/\n*(-|=){2,} *(?:\n+|$)/g, '\n* * *\n');

			post.id = id;
			post.title = postTitle;
			post.slug = postLink;
			post.markdown = postContent;
			post.image = post.meta_title = post.meta_description = null;
			post.author_id = post.created_by = post.updated_by = post.published_by = 1;
			post.html = "";
			post.page = 0;
			post.created_at = post.published_at = post.updated_at =  (+new Date(postDate));
			post.status = "published";
			post.language = 'en_US';



			switch (item['wp:post_type'][0]){
				case 'post':
					length++;

					var postStatus = item['wp:status'][0] === 'publish' ? '_posts/' : '_drafts/',
						cats = item.category;
//						categories = [],
//						postTag = [];

					_.each(cats, function(item){
						if (!_.isString(item)){
							switch(item.$.domain){
								case 'post_tag':

									//postTag.push(item._);
									var post_tag = {}
									post_tag.tag_id = parseInt(tag_name_map[item._]);
									post_tag.post_id = parseInt(id);

									console.log(post_tag.tag_id,post_tag.post_id);

									ghost.data.posts_tags.push(post_tag);


									break;
								case 'category':
									//categories.push(item._);
									break;
							}
						}
					});

//					if (postTag.length) postTag = '\n- ' + _.uniq(postTag).join('\n- ');
//					if (categories.length) categories = '\n- ' + _.uniq(categories).join('\n- ');




					ghost.data.posts.push(post);



					next();

					break;

				case 'page':
					length++;


					post.page = 1;

					next();
					break;

				default:
					next();
			}



		}, function(err){
			if (err) throw err;

			console.log('all done..');
			file.write(JSON.stringify(ghost), function(){});

			next(null, length);
		});
	}
], function(err, length){
	if (err) throw err;
	console.log('%d posts migrated.', length);
});