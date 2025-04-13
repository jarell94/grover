const multer = require("multer");
const path = require("path");

// Removed duplicate storage declaration and export
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/products/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  if (['.jpg', '.jpeg', '.png'].includes(ext)) cb(null, true);
  else cb(new Error('Only images allowed'), false);
};

module.exports = multer({ storage, fileFilter });
