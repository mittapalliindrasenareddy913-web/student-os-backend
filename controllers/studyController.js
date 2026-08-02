const StudyMaterial = require('../models/StudyMaterial');

// GET /api/study — all materials for user, optionally filtered
exports.getAll = async (req, res) => {
  try {
    const { subject, type } = req.query;
    const filter = { userId: req.user._id };
    if (subject) filter.subject = subject;
    if (type) filter.type = type;

    const materials = await StudyMaterial.find(filter)
      .select('-fileData') // Don't send binary data in list
      .sort({ createdAt: -1 });

    res.json({ success: true, count: materials.length, materials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/study/subjects — unique subjects with counts
exports.getSubjects = async (req, res) => {
  try {
    const agg = await StudyMaterial.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$subject', count: { $sum: 1 }, types: { $addToSet: '$type' } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, subjects: agg.map(s => ({ subject: s._id, count: s.count, types: s.types })) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/study/:id — single material (with fileData)
exports.getOne = async (req, res) => {
  try {
    const material = await StudyMaterial.findOne({ _id: req.params.id, userId: req.user._id });
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, material });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/study — create a material
exports.create = async (req, res) => {
  try {
    const { subject, title, type, content, fileData, fileName, fileSize, fileMime, fileUrl, tags } = req.body;

    if (!subject || !title) return res.status(400).json({ success: false, message: 'subject and title required' });

    // Limit file size: 5MB base64 (~3.75MB file)
    if (fileData && fileData.length > 5 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'File too large (max 5MB)' });
    }

    const material = await StudyMaterial.create({
      userId: req.user._id,
      subject: subject.trim(),
      title: title.trim(),
      type: type || 'note',
      content: content || '',
      fileData: fileData || '',
      fileName: fileName || '',
      fileSize: fileSize || 0,
      fileMime: fileMime || '',
      fileUrl: fileUrl || '',
      tags: tags || [],
    });

    res.status(201).json({ success: true, material: { ...material.toObject(), fileData: undefined } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/study/:id — update
exports.update = async (req, res) => {
  try {
    const { title, content, tags, fileUrl } = req.body;
    const material = await StudyMaterial.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { title, content, tags, fileUrl, updatedAt: Date.now() } },
      { new: true, select: '-fileData' }
    );
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, material });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/study/:id
exports.remove = async (req, res) => {
  try {
    const material = await StudyMaterial.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/study/:id/download (Supports Partial Range requests for Pause/Resume)
exports.downloadFile = async (req, res) => {
  try {
    const material = await StudyMaterial.findOne({ _id: req.params.id, userId: req.user._id });
    if (!material || !material.fileData) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const buffer = Buffer.from(material.fileData, 'base64');
    const total = buffer.length;

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (start >= total || end >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        return res.end();
      }

      const chunk = buffer.slice(start, end + 1);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk.length,
        'Content-Type': material.fileMime || 'application/pdf',
      });
      res.end(chunk);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': material.fileMime || 'application/pdf',
        'Accept-Ranges': 'bytes'
      });
      res.end(buffer);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
