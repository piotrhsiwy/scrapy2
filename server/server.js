import http from 'http';
import { readFile } from 'fs/promises'; // Use promises-based file reading

const HOST = 'localhost';
const PORT = 3000;
const HTML_FILE_PATH = './server/testJP.html';

// Function to handle the request
const requestListener = async (req, res) => {
    // Only serve the file for the root path (/) and GET method
    if (req.url === '/' && req.method === 'GET') {
        try {
            // 1. Read the HTML file content asynchronously
            const content = await readFile(HTML_FILE_PATH, 'utf-8');

            // 2. Set the response header
            res.setHeader('Content-Type', 'text/html');
            res.writeHead(200); // 200 OK

            // 3. Send the content and close the response
            res.end(content);
        } catch (error) {
            // Handle file reading errors (e.g., file not found)
            console.error('Error reading HTML file:', error);
            res.setHeader('Content-Type', 'text/plain');
            res.writeHead(500); // 500 Internal Server Error
            res.end('Error loading the static file.');
        }
    } else {
        // Handle all other requests (e.g., /about or POST requests)
        res.setHeader('Content-Type', 'text/plain');
        res.writeHead(404); // 404 Not Found
        res.end('404 Not Found');
    }
};

// Create the server
const server = http.createServer(requestListener);

// Start the server
server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log('Press Ctrl+C to stop the server.');
});