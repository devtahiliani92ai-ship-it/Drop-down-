# Dropzone — File Management & Instant Preview

A responsive frontend starter inspired by the supplied dashboard screenshot.

## Run it
1. Extract the ZIP.
2. Open `index.html` in a modern browser, or use VS Code Live Server.
3. Upload files using the drop area or **Upload files**.

## Included interactions
- Responsive sidebar and dashboard layout
- Drag-and-drop and browse-to-upload
- File list, search, type and size labels
- Image, PDF, text and video preview when the browser supports it
- Download when the file content remains available in this browser
- Rename, star, mark shared, move to trash, restore and permanently delete
- Basic theme toggle and profile display-name edit
- Empty states, toast feedback, dialog flows and storage usage indicators

## Important limitations
This is a working **frontend prototype**, not a deployed cloud storage service.
- Files are read in the browser. Local storage is used for demo metadata and small data URLs.
- Larger file contents are intentionally not persisted across refreshes to avoid exceeding browser storage limits.
- "Share" marks a file as shared locally; it does not create a public share URL.
- Folder creation is a UI demo and folders are not persisted.
- There is no real authentication, server-side database, antivirus scanning, or admin backend.
- GitHub Pages can host this static frontend, but real accounts, durable file uploads and secure share links require a backend and object storage.

## Suggested production architecture
- Frontend: HTML/CSS/JavaScript or React
- Backend: Node.js + Express or PHP
- Database: MySQL/PostgreSQL for users, folders, file metadata and sharing permissions
- Object storage: S3-compatible storage or another durable file storage service
- Security: authentication, authorization checks, upload validation, file size limits, rate limits and expiring signed links

Never store real passwords or sensitive files in browser local storage.
