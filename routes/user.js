const express = require('express');
const router = express.Router();

// import controller

const { requireSignin, adminMiddeware } = require('../controllers/auth');
const { read, update } = require('../controllers/user');


router.get('/user/:id', requireSignin, read);
router.put('/user/update', requireSignin, update);
router.put('/admin/update', requireSignin, adminMiddeware, update);


module.exports = router
