/*!
 * wp2ghost v0.0.1
 * Copyright 2014 Mark Ni
 * Licensed under MIT
 */


/*! modified from hexo-migrator-wordpress | MIT License | https://npmjs.org/package/hexo-migrator-wordpress */

var fs = require('graceful-fs'),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	async = require('async'),
	_ = require('underscore'),
	tomd = require('to-markdown').toMarkdown,
	EOL = require('os').EOL,
	EOLre = new RegExp(EOL, 'g');

var source = process.argv.pop();
if (!source || source.search('.xml') < 0) return console.log('\nInvalid command. \n\nUsage: node wp2ghost yourwordpressfile.xml');

var MAX_SLUG_LEN = 150; //ghost currently limit slug length to 150 in db, which is shorter than wordpress's 200 limit

// I/O Helper functions
var file = {
	read: function (source, callback) {
		fs.exists(source, function (exist) {
			if (exist) {
				fs.readFile(source, 'utf8', function (err, result) {
					if (err) return callback(err);
					callback(null, result);
				});
			} else {
				callback(null);
			}
		});
	},

	write: function (content, callback) {

		fs.open(source + '.json', "w", function (err, fd) {
			if (err) callback(err);
			fs.write(fd, content, 0, "utf8", function (err, written, buffer) {
				if (!err) {
					console.log(source + '.json has been created.');
				}
				callback(err);
			});
		});

	}
};

async.waterfall([
	function (next) {
		console.log('Fetching %s...', source);

		file.read(source, next);
	},
	function (data, next) {
		// Transform EOL
		var data = EOL === '\n' ? data : data.replace(EOLre, '\n');

		// Remove UTF BOM
		data = data.replace(/^\uFEFF/, '');

		next(null, data);
	},
	function (data, next) {
		console.log('Parsing XML...');
		parser.parseString(data, next);
	},
	function (data, next) {
		console.log('Analyzing...');

		var ghost = {
			meta: {"exported_on": (+new Date()), "version": "000"},
			data: {
				posts: [],
				tags: [],
				posts_tags: []
			}
		};

		var tag_name_map = {};

		var post_count = 0,
			page_count = 0,
			tag_count = 0,
			arr = data.rss.channel[0].item;

		var tags = data.rss.channel[0]['wp:tag'];

		if (tags && tags.length > 0) {
			console.log('Processing tags...');

			tags.forEach(function (item) {
				tag_count++;
				var tag = {};

				tag.id = parseInt(item['wp:term_id'][0]);
				tag.name = item['wp:tag_name'][0];
				tag.slug = item['wp:tag_slug'][0];
				tag.slug = tag.slug.slice(0, MAX_SLUG_LEN);
				tag.description = '';

				tag_name_map[tag.name] = tag.id;

				ghost.data.tags.push(tag);

			});
		}

		console.log('Processing Posts...');
		async.forEach(arr, function (item, done) {

			var post = {};   // a ghost post object

			var postTitle = item.title[0],
				pubDate = item.pubDate[0],
				id = parseInt(item['wp:post_id'][0]),
				postDate = item['wp:post_date'][0],
				postLink = item['wp:post_name'][0].slice(0, MAX_SLUG_LEN),
				postContent = item['content:encoded'][0];

			if (_.isObject(postTitle)) postTitle = 'Untitled';

			if (!postLink || _.isObject(postLink)) {
				if (postTitle)
					postLink = postTitle.toLowerCase().split(' ').join('-');
				else {
					postLink = item['wp:post_id'][0];
				}
			}

			postLink = item['wp:post_id'][0];
			postContent = _.isObject(postContent) ? '' : tomd(postContent);


			//performing additional fixes,  probably shouldn't do this as it doesn't check <code> <pre> blocks

			//fixing existing markdown like plaintext, '----' most likely means a hr
			postContent = postContent.replace(/\n*(-|=){2,} *(?:\n+|$)/g, '\n* * *\n');

			postContent = postContent.replace(/\r\n/g, '\n');

			//fixing line breaks with markdown syntax by adding two extra spaces
			postContent = postContent.replace(/\n/g, '  \n');
			//replacing <br> tags with markdown line break
			postContent = postContent.replace(/<br( {0,1})(\/{0,1})>/gi, '  \n');

			//TODO: need fix wordpress short code to markdown/html, such as [caption][/caption]

			post.id = id;
			post.title = postTitle;
			post.slug = postLink;
			post.markdown = postContent;
			post.image = post.meta_title = post.meta_description = null;
			post.author_id = post.created_by = post.updated_by = post.published_by = 1;
			post.html = null;
			post.page = 0;
			post.published_at = (+new Date(pubDate));
			post.created_at = post.updated_at = (+new Date(postDate));
			post.status = item['wp:status'][0] === 'publish' ? 'published' : 'draft';
			post.language = 'en_US';

			switch (item['wp:post_type'][0]) {
				case 'post':
					post_count++;

					var cats = item.category;

					_.each(cats, function (item) {
						if (!_.isString(item)) {
							switch (item.$.domain) {
								case 'post_tag':
									if (tags && tags.length > 0) {

										var post_tag = {};
										post_tag.tag_id = parseInt(tag_name_map[item._]);
										post_tag.post_id = parseInt(id);

										ghost.data.posts_tags.push(post_tag);

									}

									break;
								case 'category':

									break;
							}
						}
					});

					ghost.data.posts.push(post);

					done();

					break;

				case 'page':
					page_count++;

					post.page = 1;

					ghost.data.posts.push(post);

					done();
					break;

				default:
					done();
			}

		}, function (err) {
			if (err) throw err;

			file.write(JSON.stringify(ghost), function (err) {

				next(err, [post_count, page_count, tag_count]);
			});

		});
	}
], function (err, counter) {
	if (err) throw err;
	console.log('%d posts, %d pages and %d tags converted.', counter[0], counter[1], counter[2]);
});