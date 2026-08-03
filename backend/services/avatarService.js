const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['png', 'jpg', 'jpeg', 'webp']);

const ensureDir = () => {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
};

const parseDataUrl = (avatarData) => {
    if (typeof avatarData !== 'string') return null;
    const match = avatarData.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!match) return null;
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    if (!ALLOWED.has(ext)) return null;
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return null;
    return { ext, buffer };
};

const saveAvatar = (userId, avatarData) => {
    const parsed = parseDataUrl(avatarData);
    if (!parsed) {
        throw new Error('Invalid image. Use PNG, JPG, or WEBP under 2 MB.');
    }

    ensureDir();
    removeAvatarFiles(userId);

    const filename = `user-${userId}.${parsed.ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, parsed.buffer);
    return `/uploads/avatars/${filename}`;
};

const removeAvatarFiles = (userId) => {
    ensureDir();
    const prefix = `user-${userId}.`;
    for (const file of fs.readdirSync(UPLOAD_DIR)) {
        if (file.startsWith(prefix)) {
            fs.unlinkSync(path.join(UPLOAD_DIR, file));
        }
    }
};

module.exports = { saveAvatar, removeAvatarFiles, UPLOAD_DIR };
