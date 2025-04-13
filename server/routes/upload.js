const express = require("express");
const upload = require("../middleware/upload");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/upload", auth, upload.single("file"), (req, res) => {
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

module.exports = router;
