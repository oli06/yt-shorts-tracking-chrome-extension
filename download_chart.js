const https = require('https');
const fs = require('fs');
const path = require('path');

const file = fs.createWriteStream(path.join(__dirname, 'lib', 'chart.min.js'));
https.get('https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js', (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Chart.js downloaded successfully');
  });
}).on('error', (err) => {
  fs.unlink(path.join(__dirname, 'lib', 'chart.min.js'));
  console.error('Error downloading Chart.js:', err);
}); 