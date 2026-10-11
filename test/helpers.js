const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const chaptersDir = path.join(ROOT, "chapters");

const chapterFiles = () => fs.readdirSync(chaptersDir).filter((f) => /^\d+-.*\.md$/.test(f)).sort();
const readChapter = (f) => fs.readFileSync(path.join(chaptersDir, f), "utf8");
const loadChapters = () =>
  chapterFiles().map((file) => {
    const md = readChapter(file);
    return { file, md, title: md.match(/^# (.*)/m)[1] };
  });

module.exports = { ROOT, chaptersDir, chapterFiles, readChapter, loadChapters };
