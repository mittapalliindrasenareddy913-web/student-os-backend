/**
 * Input Payload Validators for Community endpoints.
 */
const { body } = require('express-validator');
const validatePayload = require('../../../shared/middleware/validate');

const validateCreatePost = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ min: 3, max: 150 }).withMessage('Title must be between 3 and 150 characters.'),
  body('content')
    .trim()
    .notEmpty().withMessage('Content is required.'),
  body('category')
    .optional()
    .isIn(['project', 'hackathon', 'internship', 'placement', 'notes', 'achievement', 'certificate', 'question', 'announcement', 'text'])
    .withMessage('Invalid category specified.'),
  validatePayload
];

const validateCreateComment = [
  body('content')
    .trim()
    .notEmpty().withMessage('Comment text content cannot be empty.')
    .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters.'),
  body('parentCommentId')
    .optional()
    .isString().withMessage('Parent comment ID must be a valid string.'),
  validatePayload
];

module.exports = {
  validateCreatePost,
  validateCreateComment
};
