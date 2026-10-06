CINEMA MANAGEMENT - EMPTY MONGODB DATABASE SET

This package contains NO seed/sample documents.

WHAT IT CREATES
- Database: cinema_management
- 23 empty collections
- MongoDB collection validators based on the current SDS
- Unique/compound indexes defined in the SDS

IMPORTANT
- The 23 *.json files contain [] only. They are placeholders/reference files and contain NO data.
- Do NOT use mongoimport to create the empty database. Importing an empty JSON array is not a reliable way to create an empty collection.
- Use setup_empty_db.bat (Windows) or setup_empty_db.sh (macOS/Linux).
- Cross-collection ObjectId references still must be validated by application/service logic.

WINDOWS
1. Ensure mongosh is installed and available in PATH.
2. Open Command Prompt in this folder.
3. Run:
   setup_empty_db.bat

MANUAL WINDOWS / ANY OS
mongosh --file create_empty_db.js
mongosh --file create_indexes.js

After running, open MongoDB Compass and refresh.
You should see database cinema_management with 23 empty collections.

FILES
- 23 empty JSON files, one per collection
- create_empty_db.js    -> creates collections + validators
- create_indexes.js     -> creates SDS indexes
- setup_empty_db.bat    -> Windows one-click setup
- setup_empty_db.sh     -> macOS/Linux setup
