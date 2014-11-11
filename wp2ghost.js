#!/usr/bin/env node

/*!
 * wp2ghost v0.3.7
 * Copyright 2014 Mark Ni
 * Licensed under MIT
 */


'use strict';

process.title = "wp2ghost"

var source = process.argv.pop();

if (!source || source.search('.xml') !== source.length-4) return console.log('\nInvalid command. \n\nUsage: node wp2ghost yourwordpressfile.xml');

var ProgressBar = require('progress');
var fs = require('graceful-fs');
var	xml2js = require('xml2js');
var parser = new xml2js.Parser();
var async = require('async');
var _ = require('underscore');
var tomd = require('to-markdown').toMarkdown;
var EOL = require('os').EOL;
var EOLre = new RegExp(EOL, 'g');
var MAX_SLUG_LEN = 150; //ghost currently limit slug length to 150 in db, which is shorter than wordpress's 200 limit
var MAX_POST_TITLE_LEN = 150; //ghost currently limit title length to 150 in db, while wordpress is unlimited
var bar;

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
			fs.write(fd, content, 0, "utf8", function (err) {
				if (!err) {
					console.log('\n'+source + '.json has been created.');
				}
				callback(err);
			});
		});

	}
};

async.waterfall([
	function (next) {
		console.log('\nFetching %s \n', source);


		file.read(source, next);
	},
	function (data, next) {
		bar = new ProgressBar('Parsing XML [:bar] :percent :elapseds', {
			width: 20,
			total: 10
		});

		// Transform EOL
		data = EOL === '\n' ? data : data.replace(EOLre, '\n');

		// Remove UTF BOM
		data = data.replace(/^\uFEFF/, '');

		next(null, data);
	},
	function (data, next) {
		bar.tick(1);

		parser.parseString(data, next);
	},
	function (data,next){
		bar.tick(9);
		var items = data.rss.channel[0].item;

		bar = new ProgressBar('Processing attachments [:bar] :percent :elapseds', {
			width: 20,
			total: items.length
		});

		var attachments = {};
		var parent_child_map = {};

		var unused_items = [];

		async.forEach(items, function (item, done) {
				bar.tick();
				var postType = item['wp:post_type'][0];

				if (postType === 'attachment'){
					var url = item['wp:attachment_url'][0];
					var caption = item['content:encoded'][0];
					var alt = item['excerpt:encoded'][0];
					var id = item['wp:post_id'][0];
					var parent = item['wp:post_parent'][0];
					if(!parent_child_map.hasOwnProperty(parent)){
						parent_child_map[parent] = [];
					}

					attachments[id] = {url:url,alt:alt,caption:caption};
					parent_child_map[parent].push(attachments[id] );

				}
			  else {
					unused_items.push(item);
				}
				done();

		}, function(err){
			if (err) throw err;

			data.rss.channel[0].item = unused_items;

			data.extra = {};
			data.extra.attachments = attachments;
			data.extra.parent_child_map = parent_child_map;


			next(null,data);
		});

	},

	function (data, next) {

		var ghost = {
			meta: {"exported_on": (+new Date()), "version": "000"},
			data: {
				posts: [],
				tags: [],
				posts_tags: []
			}
		};

		var tag_name_map = {};

		var post_count = 0;
		var page_count = 0;
		var tag_count = 0;
		var arr = data.rss.channel[0].item;

		var tags = data.rss.channel[0]['wp:tag'];

		if (tags && tags.length > 0) {
			bar = new ProgressBar('Processing tags [:bar] :percent :elapseds', {
				width: 20,
				total: tags.length
			});


			tags.forEach(function (item, i) {
				bar.tick();
				tag_count++;
				var tag = {};

				tag.id = item['wp:term_id'] ? parseInt(item['wp:term_id'][0]) : i;
				tag.name = item['wp:tag_name'][0];
				tag.slug = item['wp:tag_slug'][0];
				tag.slug = tag.slug.slice(0, MAX_SLUG_LEN);
				tag.description = '';

				tag_name_map[tag.name] = tag.id;

				ghost.data.tags.push(tag);

			});
		}

		bar = new ProgressBar('Processing posts [:bar] :percent :elapseds', {
			width: 20,
			total: arr.length
		});

		async.forEach(arr, function (item, done) {

			bar.tick();

			var postType = item['wp:post_type'][0];

			if (postType === 'post' || postType === 'page'){

				var post = {};   // a ghost post object

				var postTitle = item.title[0];
				var	pubDate = item.pubDate[0];
				var	id = parseInt(item['wp:post_id'][0]);
				var	postDate = item['wp:post_date'][0];
				var	postLink = item['wp:post_name'][0].slice(0, MAX_SLUG_LEN);
				var	postContent = item['content:encoded'][0];
				var	postMetas = item['wp:postmeta'] || [];
				var postImage = null;


				postMetas.forEach(function(meta){

					//todo: add support for seo meta info
					if(meta.hasOwnProperty('wp:meta_key') && meta['wp:meta_key'] == '_thumbnail_id'){

						var attachment_id = meta['wp:meta_value'];     // this is a string
						var feature_image = data.extra.attachments[attachment_id];

						if(feature_image && feature_image.url){

							postImage = feature_image.url;

						}
					}
				});


				//process post title to correct fomart
				if (_.isObject(postTitle)) postTitle = '(Untitled)';
				if (postTitle==='') postTitle = '(Untitled)';
				postTitle = postTitle.slice(0, MAX_POST_TITLE_LEN);



				if (!postLink || _.isObject(postLink)) {
					if (postTitle)
						postLink = postTitle.toLowerCase().split(' ').join('-');
					else {
						postLink = item['wp:post_id'][0];
					}
				}

				postContent = _.isObject(postContent) ? '' : tomd(postContent);


				//performing additional fixes,  probably shouldn't do this as it doesn't check <code> <pre> blocks

				//fixing existing markdown like plaintext, '----' most likely means a hr
				postContent = postContent.replace(/\n*(-|=){2,} *(?:\n+|$)/g, '\n* * *\n');

				postContent = postContent.replace(/\r\n/g, '\n');

				//fixing line breaks with markdown syntax by adding two extra spaces
				postContent = postContent.replace(/\n/g, '  \n');

				//replacing <br> tags with markdown line break
				postContent = postContent.replace(/<br( {0,1})(\/{0,1})>/gi, '  \n');

				//TODO: need fix build-in wordpress short code to markdown/html, such as [caption][/caption]

//				postContent = postContent.replace(/\[gallery(.*?)\]/g, function(match){
//					console.log(id,postTitle);
//					var imgs = data.extra.parent_child_map[id];
//					var md = '';
//					imgs.forEach(function(img){
//						md+= '!['+img.alt+']('+img.url+' "'+ img.caption +'")\n';
//					});
//
//					return md;
//				});

				post.id = id;
				post.title = postTitle;
				post.slug = postLink;
				post.markdown = postContent;
				post.image = postImage;
				post.meta_title = post.meta_description = null;
				post.author_id = post.created_by = post.updated_by = post.published_by = 1;
				post.html = null; // to save import time, discard old htmls; could have an option to keep them
				post.page = 0;
				post.published_at = (+new Date(pubDate));
				post.created_at = post.updated_at = (+new Date(postDate));
				post.status = item['wp:status'][0] === 'publish' ? 'published' : 'draft';
				post.language = 'en_US';

				switch (postType) {
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

			}
			else{
				done();
			}



		}, function (err) {
			if (err) throw err;

			file.write(JSON.stringify(ghost,null,'\t'), function (err) {

				next(err, [post_count, page_count, tag_count]);
			});

		});
	}
], function (err, counter) {
	if (err) throw err;
	console.log('\n%d posts, %d pages and %d tags converted.\n', counter[0], counter[1], counter[2]);
});