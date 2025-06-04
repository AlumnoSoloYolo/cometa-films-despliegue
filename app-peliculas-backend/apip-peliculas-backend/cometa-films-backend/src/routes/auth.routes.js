const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { registerUser, loginUser, verifyPassword } = require('../controllers/auth.controller');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-password', auth, verifyPassword);

module.exports = router;