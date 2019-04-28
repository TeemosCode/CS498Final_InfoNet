var express = require('express'),
	router = express.Router(),
	Post = require('../models/postSchema'),
	mongoose = require('mongoose'),
	User = require('../models/userSchema');
	Comment = require('../models/commentSchema'),
	auth = require('./auth');


router.use(express.json())


function appendStringParen(queryParam) {
	return '(' + queryParam + ')';
}

// Get every post there is (For certain category & University???? <- Still needs logic implementation and design)
router.get('/', auth.optional, function(req, res) {
	// Moongoose use...
	const query = req.query;
	console.log(req.query);
	console.log("(" + req.query.where + ")");
	console.log(req.query.sort);
	console.log(req.query.select);
	console.log(req.query.skip);
	console.log(req.query.limit);
	const whereParam = query.where ? eval(appendStringParen(query.where)) : {};
	const selectParam = query.select ? eval(appendStringParen(query.select)) : {};
	const sortParam = query.sort ? eval(appendStringParen(query.sort)) : {};
	const skipParam = query.skip ? eval(appendStringParen(query.skip)) : 0;
	const limitParam = query.limit ? eval(appendStringParen(query.limit)) : 0;
	const countTrue = query.count ? eval(query.count) : false;

	Post.find(whereParam).select(selectParam).sort(sortParam).skip(skipParam).limit(limitParam).populate('postedBy')
		.exec()
		.then((tasks_list) => {
			res.status(200).send({
				message: countTrue? "OK. Returned total count of retrieved data." : "OK. List of Posts.",
				data: countTrue ? tasks_list.length : tasks_list
			});
		}).catch((err) => {
			res.status(500).send({
				message: "Unable to retrieve post list",
				data: []
			});
		});
});


router.get('/:postId', auth.optional, (req, res, next) => {
	// console.log(req.headers);
	const id = req.params.postId;
	Post
	.findById(id)
	.exec()
	.then(post => {
		if (!post) {
			return res.status(404).json({
				message: "Post does not exist!"
			});
		}
		User.findById(post.postedBy).exec().then(user => {
			res.status(200).json({
				message: "Find Post!",
				data: post,
				postedBy: user.username
			});	
		}).catch(err => {
			res.status(500).json({
				error: err
			});
		})
	})
	.catch(err => {
		res.status(500).json({
			error: err
		});
	});
});


// Get certain post based on UserID   Can put queries at the end 
router.get('/user/:id', auth.optional, function(req, res) {

	const query = req.query;
	// If not specified, then its just throwing out all posts created by that user...
	const whereParam = query.where ? eval(appendStringParen(query.where)) : {};
	whereParam.postedBy = req.params.id;
	
	Post.findOne(whereParam).exec()
	.then((task) => {
		if (task) {
			res.status(200).send({
				message: `OK. Post ID: ${req.params.id} found.`,
				data:task
			});
		} else {
			res.status(404).send({
				message: `Cannot Find Post of ID: ${req.params.id}`,
				data:[],
			});
		}
	}).catch((error) => {
		console.log(error);
		res.status(500).send({
			message: `Server Error: ${error.name}: Cast to number failed for value '${error.value}' at path '${error.path}' for model 'Post' `,
			data:[]
		})
	});
});


// Create new post
router.post('/', auth.optional, (req, res, next) => {
	const newPost = new Post({
		_id: new mongoose.Types.ObjectId(),
		title: req.body.title,
		context: req.body.context,
		likeCount: req.body.likeCount,
		createdTime: req.body.createdTime,
		university: req.body.university,
		comments: req.body.comments,
		postedBy: req.body.postedBy,
		category: req.body.category
	});
	newPost
	.save()
	.then(result => {
		res.status(201).json({
			message: "Create Post succesfully",
			createdPost: {
				_id: newPost._id,
				title: newPost.title,
				context: newPost.context,
				likeCount: newPost.likeCount,
				createdTime: newPost.createdTime,
				university: newPost.university,
				comments: newPost.comments,
				postedBy: newPost.postedBy,
				category: newPost.category
			}
		});
	})
	.catch(err => {
		res.status(500).json({
			error: err
		});
	});
});

router.delete('/:postId', auth.optional, (req, res, next) => {
	Post
	.findById(req.params.postId)
	.then(post => {
		if (!post) {
			return res.status(404).json({
				message: "Provided postId does not exist"
			});
		}
		if (post.comments.length > 0) {
			post.comments.map(id => {
				Comment.remove({
					_id: id
				})
				.exec()
				.catch(err => {
					res.status(500).json({
						error: err
					});
				});
			});
		} 
		return post
		.remove()
		.then(result => {
			res.status(200).json({
				message: `Delete post ${req.params.postId} succesfully!`
			});
		});
	})
	.catch(err => {
		res.status(500).json({
			error: err
		});
	});

});

router.patch('/:postId', auth.optional, (req, res, next) => {
	const id = req.params.postId;
	const updateOps = {};
    for (const ops of req.body) {
        updateOps[ops.propName] = ops.value;
    }
	Post
	.findById(id)
	.exec()
	.then(post => {
		if (!post) {
			return res.status(404).json({
				message: "Post does not exist!"
			});
		}
		Post
		.update({_id: id
		}, {
			$set: updateOps
		})
		.exec()
		.then(result => {	
			res.status(200).json({
				message: "Update Post Successfully!",
				result: result
			})
		});
	}).catch(err => {
    	res.status(500).json({
            error: err
        });
    });
});


// Liking a post
router.post('/like/', auth.optional, (req, res, next) => {
	// postid will be within the req.body
	// {postId: [postid]}
	Post.findOneAndUpdate({_id: req.body.postId}, {$inc: {likeCount: 1}}, {new: true}).exec()
		.then(updatedPost => {
			if (!updatedPost) {
				return res.status(404).json({
					message: "Post does not exist!"
				});
			}
			// Currently pretend that the user would be passed within the request.body, for the sake of postman testing (before knowing how passport works...)
			User.update({_id: req.body.userId}, {$push: {likes: updatedPost._id}}).exec()
				.then(user => {
					res.status(200).send({
						message: `User ${req.body.userId} Liked ${req.body.postId}`,
					});
				}).catch(err => {
					res.status(500).send({
						message: `Error: ${err}`,
					});
				})
		}).catch(err => {
			res.status(500).send({
				message: `Error: ${err}`,
			});
		});
});

// Unlike a post
router.post('/unlike', auth.optional, (req, res, next) => {
	Post.findOneAndUpdate({_id: req.body.postId}, {$inc: {likeCount: -1}}, {new: true}).exec()
		.then(updatedPost => {
			if (!updatedPost) {
				return res.status(404).json({
					message: "Post does not exist!"
				});
			}
			// Currently pretend that the user would be passed within the request.body, for the sake of postman testing (before knowing how passport works...)
			User.update({_id: req.body.userId}, {$pull: {likes: updatedPost._id}}).exec()
				.then(user => {
					res.status(200).send({
						message: `User ${req.body.userId} Unliked ${req.body.postId}`,
					});
				}).catch(err => {
					res.status(500).send({
						message: `Error: ${err}`,
					});
				})
		}).catch(err => {
			res.status(500).send({
				message: `Error: ${err}`,
			});
		});
})



module.exports = router;