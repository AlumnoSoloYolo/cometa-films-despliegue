const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getAllUsers,
    searchUsers,
    getUserPublicProfile,
    followUser,
    unfollowUser,
    getFollowStatus,
    getPendingRequests,
    acceptFollowRequest,
    rejectFollowRequest,
    cancelFollowRequest,
    getUserFollowers,
    getUserFollowing,
    removeFollower
} = require('../controllers/userSocialController');

// Todas las rutas requieren autenticación
router.use(auth);

// Rutas para la funcionalidad social
router.get('/users', getAllUsers);
router.get('/users/search', searchUsers);
router.get('/users/:userId', getUserPublicProfile);
router.post('/follow/:userId', followUser);
router.delete('/follow/:userId', unfollowUser);
router.get('/follow/:userId/status', getFollowStatus);
router.get('/follow/requests', getPendingRequests);
router.post('/follow/requests/:requestId/accept', acceptFollowRequest);
router.post('/follow/requests/:requestId/reject', rejectFollowRequest);
router.delete('/follow/requests/:requestId/cancel', cancelFollowRequest);
router.get('/users/:userId/followers', getUserFollowers);
router.get('/users/:userId/following', getUserFollowing);
router.delete('/follower/:followerId/remove', removeFollower);

module.exports = router;