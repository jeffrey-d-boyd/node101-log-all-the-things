const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const LOG_DIR = path.join(__dirname, '..');
const LOG_FILE = path.join(LOG_DIR, 'log.csv');
const HEADER = 'Agent,Time,Method,Resource,Version,Status';
const MAX_LINES = 20;

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, HEADER + '\n');
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).length;
}

function rotateLogs() {
  let n = 1;
  while (fs.existsSync(path.join(LOG_DIR, `log${n}.csv`))) n++;

  for (let i = n - 1; i >= 1; i--) {
    fs.renameSync(
      path.join(LOG_DIR, `log${i}.csv`),
      path.join(LOG_DIR, `log${i + 1}.csv`)
    );
  }

  fs.renameSync(LOG_FILE, path.join(LOG_DIR, 'log1.csv'));
  fs.writeFileSync(LOG_FILE, HEADER + '\n');
}

app.use((req, res, next) => {
  res.on('finish', () => {
    const agent = (req.headers['user-agent'] || '').replace(/,/g, ';');
    const time = new Date().toISOString();
    const method = req.method;
    const resource = req.originalUrl;
    const version = `HTTP/${req.httpVersion}`;
    const status = res.statusCode;
    const line = `${agent},${time},${method},${resource},${version},${status}`;

    console.log(line);

    if (countLines(LOG_FILE) >= MAX_LINES) {
      rotateLogs();
    }

    fs.appendFile(LOG_FILE, line + '\n', (err) => {
      if (err) console.error(err);
    });
  });

  next();
});

app.get('/', (req, res) => {
  res.status(200).send('ok');
});

app.get('/logs', (req, res) => {
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Unable to read log file' });
    }

    const lines = data.trim().split('\n').filter(Boolean);
    const headers = lines[0].split(',');
    const logs = lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce((entry, header, i) => {
        entry[header] = values[i];
        return entry;
      }, {});
    });

    res.json(logs);
  });
});

module.exports = app;
